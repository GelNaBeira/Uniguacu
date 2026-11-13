import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resourcePermissions, type PermissionProfile } from "../lib/auth/permissions.ts";
import { keySchema, carSchema, resourceSchema, resourceError, type ResourceEntity } from "../lib/resources/schema.ts";
import { executeResourceCommand, type ResourceRepository } from "../lib/resources/service.ts";
import { parseResourceQuery, resourceListUrl, pageRange, escapeLike } from "../lib/resources/pagination.ts";

const id = "50000000-0000-4000-8000-000000000001";
const admin: PermissionProfile = { role: "ADMIN", is_active: true, limited_access: null };
const user: PermissionProfile = { role: "USER", is_active: true, limited_access: { version: 1, can_read_inventory: true, can_manage_keys: true, can_manage_cars: true, can_delete: false } };
function fixture(result = { id: id as string | null, failed: false, errorCode: undefined as string | undefined }) {
  const calls: { operation: string; values?: unknown }[] = [];
  const repository: ResourceRepository = {
    create: async (values) => { calls.push({ operation: "create", values }); return result; },
    update: async (_id, values) => { calls.push({ operation: "update", values }); return result; },
    correctCar: async (_id, values) => { calls.push({ operation: "correctCar", values }); return result; },
    remove: async () => { calls.push({ operation: "delete" }); return result; },
  };
  return { calls, repository };
}

for (const entity of ["keys", "cars"] as ResourceEntity[]) {
  test(`${entity}: ADMIN ativo possui CRUD; inativo perde tudo`, () => {
    assert.equal(resourcePermissions(admin, entity).canDelete, true);
    assert.deepEqual(resourcePermissions({ ...admin, is_active: false }, entity), { canRead: false, canManage: false, canDelete: false, canCorrectMileage: false });
    assert.equal(resourcePermissions(user, entity).canManage, true);
    assert.equal(resourcePermissions(user, entity).canCorrectMileage, false);
  });
  test(`${entity}: criação usa apenas dados de cadastro, sem status nem campos técnicos`, async () => {
    const f = fixture(); const values = entity === "cars" ? { name: "  Recurso  ", mileage: 10 } : { name: "  Recurso  " };
    assert.equal((await executeResourceCommand(entity, user, f.repository, { type: "create", values })).success, true);
    assert.deepEqual(f.calls[0], { operation: "create", values: { ...values, name: "Recurso" } });
    for (const extra of [{ status: "DISPONIVEL" }, { status: "INDISPONIVEL" }, { id }]) {
      assert.equal((await executeResourceCommand(entity, admin, f.repository, { type: "create", values: { ...values, ...extra } })).success, false);
    }
    assert.equal(f.calls.length, 1);
  });
  test(`${entity}: USER edita somente nome; status injetado é rejeitado`, async () => {
    const f = fixture();
    assert.equal((await executeResourceCommand(entity, user, f.repository, { type: "update", id, values: { name: "Novo" } })).success, true);
    assert.equal((await executeResourceCommand(entity, user, f.repository, { type: "update", id, values: { name: "Novo", status: "DISPONIVEL" } })).success, false);
    assert.deepEqual(f.calls, [{ operation: "update", values: { name: "Novo" } }]);
  });
  test(`${entity}: USER sem leitura ou flag específica não escreve`, async () => {
    const flag = entity === "cars" ? "can_manage_cars" : "can_manage_keys";
    for (const limited_access of [{ version: 1, [flag]: true }, { version: 1, can_read_inventory: true }, { version: 2, can_read_inventory: true, [flag]: true }, { version: 1, can_read_inventory: true, [flag]: "true" }]) {
      const f = fixture();
      assert.equal((await executeResourceCommand(entity, { ...user, limited_access }, f.repository, { type: "update", id, values: { name: "Novo" } })).success, false);
      assert.equal(f.calls.length, 0);
    }
  });
  test(`${entity}: can_delete obrigatório e revogação respeitada`, async () => {
    const f = fixture();
    assert.equal((await executeResourceCommand(entity, user, f.repository, { type: "delete", id })).success, false);
    const allowed = { ...user, limited_access: { ...user.limited_access as object, can_delete: true } };
    assert.equal((await executeResourceCommand(entity, allowed, f.repository, { type: "delete", id })).success, true);
    assert.equal((await executeResourceCommand(entity, { ...allowed, is_active: false }, f.repository, { type: "delete", id })).success, false);
    assert.equal(f.calls.length, 1);
  });
  test(`${entity}: ID inválido, nome vazio e FK/42501/zero linhas tratados`, async () => {
    const f = fixture();
    assert.equal((await executeResourceCommand(entity, admin, f.repository, { type: "delete", id: "x" })).success, false);
    assert.equal((await executeResourceCommand(entity, user, f.repository, { type: "update", id, values: { name: " " } })).success, false);
    assert.equal(f.calls.length, 0);
    for (const errorCode of ["23503", "42501", "23514"]) {
      const failed = fixture({ id: null, failed: true, errorCode });
      assert.deepEqual(await executeResourceCommand(entity, admin, failed.repository, { type: "delete", id }), { success: false, message: resourceError(errorCode) });
    }
    assert.equal((await executeResourceCommand(entity, admin, fixture({ id: null, failed: false, errorCode: undefined }).repository, { type: "delete", id })).success, false);
  });
}
test("carros: quilometragem inteira opcional, limites e negativos", () => {
  for (const mileage of [null, 0, 12000, 2147483647]) assert.equal(carSchema.safeParse({ name: "Carro", mileage }).success, true);
  for (const mileage of [-1, 1.5, NaN, "100", 2147483648, undefined]) assert.equal(carSchema.safeParse({ name: "Carro", mileage }).success, false);
});
test("chaves: não aceitam mileage; schemas rejeitam status até para ADMIN", () => {
  assert.equal(keySchema.safeParse({ name: "Chave", mileage: 0 }).success, false);
  assert.equal(resourceSchema("cars", true, true).safeParse({ name: "Carro", mileage: 0, status: "DISPONIVEL" }).success, false);
});
test("carros: USER informa mileage inicial mas não corrige nem chama RPC", async () => {
  const f = fixture();
  assert.equal((await executeResourceCommand("cars", user, f.repository, { type: "create", values: { name: "Carro", mileage: 500 } })).success, true);
  assert.equal((await executeResourceCommand("cars", user, f.repository, { type: "update", id, values: { name: "Carro", mileage: 100 } })).success, false);
  assert.equal(f.calls.length, 1);
});
test("carros: ADMIN corrige nome+mileage via RPC exclusiva e não update direto", async () => {
  const f = fixture();
  assert.equal((await executeResourceCommand("cars", admin, f.repository, { type: "update", id, values: { name: " Carro ", mileage: 1000 } })).success, true);
  assert.deepEqual(f.calls, [{ operation: "correctCar", values: { name: "Carro", mileage: 1000 } }]);
});
test("flags de carros/chaves são independentes", () => {
  const profile = { ...user, limited_access: { version: 1, can_read_inventory: true, can_manage_keys: true } };
  assert.equal(resourcePermissions(profile, "keys").canManage, true);
  assert.equal(resourcePermissions(profile, "cars").canManage, false);
});
test("entidade fora da allowlist e falha de rede não acessam/expõem banco", async () => {
  const f = fixture();
  assert.equal((await executeResourceCommand("usuarios", admin, f.repository, { type: "delete", id })).success, false);
  assert.equal(f.calls.length, 0);
  f.repository.remove = async () => { throw new Error("segredo interno"); };
  assert.deepEqual(await executeResourceCommand("keys", admin, f.repository, { type: "delete", id }), { success: false, message: resourceError() });
});
test("busca/paginação preservam status e rejeitam filtros inválidos", () => {
  assert.deepEqual(parseResourceQuery({ page: "2", q: " Chave ", status: "DISPONIVEL" }), { page: 2, query: "Chave", status: "DISPONIVEL", invalid: false });
  assert.equal(parseResourceQuery({ status: "created" }).invalid, true);
  assert.equal(parseResourceQuery({ status: "INDISPONIVEL" }).invalid, false);
  const url = new URL(resourceListUrl("cars", 3, "A&B", "INDISPONIVEL"), "http://localhost");
  assert.equal(url.searchParams.get("status"), "INDISPONIVEL"); assert.equal(url.searchParams.get("q"), "A&B");
  assert.deepEqual(pageRange(2), { from: 10, to: 19 }); assert.equal(escapeLike("100%_"), "100\\%\\_");
});
test("0007 contém oito policies, proteção por coluna e gate ADMIN real na RPC", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0007_keys_cars_crud.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("array['keys','car_keys']"));
  for (const operation of ["select", "insert", "update", "delete"]) assert.ok(sql.includes(`t || '_${operation}'`));
  assert.ok(sql.includes("grant update (name)"));
  assert.ok(sql.includes("status = ''DISPONIVEL''"));
  assert.ok(sql.includes("can_manage_keys")); assert.ok(sql.includes("can_manage_cars"));
  assert.ok(sql.includes("if (select auth.uid()) is null or not private.is_admin()"));
  assert.ok(sql.includes("security definer set search_path = ''"));
  assert.ok(sql.includes("set name = btrim(p_name), mileage = p_mileage"));
  assert.ok(sql.includes("from public, anon, authenticated"));
  assert.ok(sql.includes("p.roles = array['authenticated']::name[]"));
  assert.ok(sql.includes("has_column_privilege('authenticated','public.car_keys','mileage','UPDATE')"));
});