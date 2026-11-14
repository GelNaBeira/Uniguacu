import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeProductPhoto } from "../lib/products/remove-photo.ts";

const id = "40000000-0000-4000-8000-000000000001";
const path = `${id}/40000000-0000-4000-8000-000000000002.png`;
function clientMock(options: { current?: string | null; readError?: boolean; updateError?: boolean; conflict?: boolean; storageError?: boolean; emptyRemoval?: boolean; storageThrows?: boolean } = {}) {
  const calls: unknown[] = [];
  let updating = false;
  const query = {
    select: (columns: string) => { calls.push(["select", columns]); return query; },
    eq: (column: string, value: unknown) => { calls.push(["eq", column, value]); return query; },
    update: (values: unknown) => { updating = true; calls.push(["update", values]); return query; },
    maybeSingle: async () => updating
      ? { data: options.conflict ? null : { id }, error: options.updateError ? {} : null }
      : { data: { image_path: options.current === undefined ? path : options.current }, error: options.readError ? {} : null },
  };
  const client = {
    from: (table: string) => { calls.push(["from", table]); return query; },
    storage: { from: (bucket: string) => ({ remove: async (paths: string[]) => {
      calls.push(["remove", bucket, paths]);
      if (options.storageThrows) throw new Error("network");
      return { data: options.emptyRemoval ? [] : [{ name: path }], error: options.storageError ? {} : null };
    } }) },
  } as unknown as SupabaseClient;
  return { client, calls };
}
test("remover foto: desvincula com comparação de versão antes de excluir o arquivo exato", async () => {
  const { client, calls } = clientMock();
  assert.equal(await removeProductPhoto(client, id, path), undefined);
  assert.deepEqual(calls.filter((call) => ["update", "remove"].includes((call as string[])[0])), [
    ["update", { image_path: null }], ["remove", "product-images", [path]],
  ]);
  assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(["eq", "image_path", path])));
});
test("remover foto: caminho de outro produto ou inválido não acessa banco/Storage", async () => {
  for (const invalid of ["x", path.replace(id, "40000000-0000-4000-8000-000000000099"), `${id}/../../foto.png`]) {
    const { client, calls } = clientMock();
    assert.ok(await removeProductPhoto(client, id, invalid)); assert.equal(calls.length, 0);
  }
});
test("remover foto: falha de leitura, foto substituída ou conflito não excluem arquivo", async () => {
  for (const options of [{ readError: true }, { current: null }, { current: `${id}/outra.png` }, { updateError: true }, { conflict: true }]) {
    const { client, calls } = clientMock(options);
    assert.ok(await removeProductPhoto(client, id, path));
    assert.equal(calls.some((call) => (call as string[])[0] === "remove"), false);
  }
});
test("remover foto: falha, recusa silenciosa ou exceção no Storage informam limpeza pendente", async () => {
  for (const options of [{ storageError: true }, { emptyRemoval: true }, { storageThrows: true }]) {
    const { client } = clientMock(options);
    assert.match((await removeProductPhoto(client, id, path))!, /Storage ficou pendente/);
  }
});
test("remover foto: policy exige gerenciamento, protege referências e não exige can_delete", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0014_product_image_removal.sql", import.meta.url), "utf8");
  assert.match(sql, /alter policy product_images_delete on storage.objects/);
  assert.match(sql, /bucket_id = 'product-images'/);
  assert.match(sql, /private.product_image_path_valid\(name\)/);
  assert.match(sql, /private.has_permission\('can_manage_products'\)/);
  assert.match(sql, /not exists.*p.image_path = storage.objects.name/);
  assert.doesNotMatch(sql, /can_delete/);
});