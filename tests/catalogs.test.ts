import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogs, catalogError, supplierSchema, catalogPayload, type CatalogEntity } from "../lib/catalogs/schema.ts";
import { executeCatalogCommand, type CatalogRepository } from "../lib/catalogs/service.ts";
import { catalogListUrl, parseCatalogQuery, pageRange, escapeLike } from "../lib/catalogs/pagination.ts";
import type { PermissionProfile } from "../lib/auth/permissions.ts";

const id = "30000000-0000-4000-8000-000000000001";
const admin: PermissionProfile = { role: "ADMIN", is_active: true, limited_access: {} };
const user: PermissionProfile = { role: "USER", is_active: true, limited_access: { version: 1, can_read_inventory: true, can_manage_catalogs: true, can_delete: false } };
function values(entity: CatalogEntity) { return Object.fromEntries(catalogs[entity].fields.map((field) => [field.name, field.required ? " Teste " : ""])); }
function fixture(errorCode?: string, missing = false) {
  const calls: unknown[][] = [];
  const result = { id: missing ? null : id, errorCode };
  const repository: CatalogRepository = {
    create: async (...args) => { calls.push(["create", ...args]); return result; },
    update: async (...args) => { calls.push(["update", ...args]); return result; },
    remove: async (...args) => { calls.push(["delete", ...args]); return result; },
  };
  return { calls, repository };
}

for (const entity of Object.keys(catalogs) as CatalogEntity[]) {
  test(`${entity}: nome obrigatório, trim, allowlist e campos opcionais NULL`, () => {
    const config = catalogs[entity];
    assert.equal(config.schema.safeParse({ ...values(entity), [config.nameColumn]: " \t\n " }).success, false);
    assert.equal(config.schema.safeParse({ ...values(entity), role: "ADMIN" }).success, false);
    assert.equal(config.schema.safeParse({ ...values(entity), id }).success, false);
    const parsed = config.schema.parse(values(entity));
    assert.equal(parsed[config.nameColumn], "Teste");
    for (const field of config.fields.filter((field) => !field.required)) assert.equal(catalogPayload(entity, parsed)[field.name], null);
  });
  test(`${entity}: ADMIN e USER autorizado criam e editam sem campos técnicos`, async () => {
    const f = fixture();
    assert.equal((await executeCatalogCommand(entity, user, f.repository, { type: "create", values: values(entity) })).success, true);
    assert.equal((await executeCatalogCommand(entity, admin, f.repository, { type: "update", id, values: values(entity) })).success, true);
    assert.equal(f.calls.length, 2);
    const payload = f.calls[0][1] as Record<string, unknown>;
    assert.equal(payload[catalogs[entity].nameColumn], "Teste"); assert.equal("created_at" in payload, false); assert.equal("id" in payload, false);
  });
  test(`${entity}: USER sem can_delete é negado; flag permite; revogação bloqueia`, async () => {
    const f = fixture();
    assert.equal((await executeCatalogCommand(entity, user, f.repository, { type: "delete", id })).success, false);
    assert.equal(f.calls.length, 0);
    const allowed = { ...user, limited_access: { version: 1, can_read_inventory: true, can_manage_catalogs: true, can_delete: true } };
    assert.equal((await executeCatalogCommand(entity, allowed, f.repository, { type: "delete", id })).success, true);
    assert.equal((await executeCatalogCommand(entity, admin, f.repository, { type: "delete", id })).success, true);
    assert.equal((await executeCatalogCommand(entity, user, f.repository, { type: "delete", id })).success, false);
    assert.equal(f.calls.length, 2);
  });
  test(`${entity}: sem leitura/manage, inativo ou JSON inválido não escreve`, async () => {
    const f = fixture();
    for (const profile of [{ ...admin, is_active: false }, { ...user, limited_access: {} },
      { ...user, limited_access: { version: 1, can_read_inventory: true, can_delete: true } },
      { ...user, limited_access: { version: 1, can_manage_catalogs: true, can_delete: true } },
      { ...user, limited_access: { version: 1, can_read_inventory: "true", can_manage_catalogs: true } }]) {
      assert.equal((await executeCatalogCommand(entity, profile, f.repository, { type: "create", values: values(entity) })).success, false);
      assert.equal((await executeCatalogCommand(entity, profile, f.repository, { type: "delete", id })).success, false);
    }
    assert.equal(f.calls.length, 0);
  });
  test(`${entity}: UUID inválido, conflito FK/unique, zero linhas e rede tratados`, async () => {
    const f = fixture();
    assert.equal((await executeCatalogCommand(entity, admin, f.repository, { type: "update", id: "invalid", values: values(entity) })).success, false);
    assert.equal(f.calls.length, 0);
    for (const code of ["23503", "23505", "42501", "23514", "internal"]) {
      assert.deepEqual(await executeCatalogCommand(entity, admin, fixture(code).repository, { type: "delete", id }), { success: false, message: catalogError(entity, code) });
    }
    assert.equal((await executeCatalogCommand(entity, admin, fixture(undefined, true).repository, { type: "delete", id })).success, false);
    f.repository.remove = async () => { throw new Error("SQL confidencial"); };
    assert.deepEqual(await executeCatalogCommand(entity, admin, f.repository, { type: "delete", id }), { success: false, message: catalogError(entity) });
  });
  test(`${entity}: paginação/busca preservam rota e escapam curingas`, () => {
    assert.deepEqual(parseCatalogQuery({ page: "2", q: " Nome " }), { page: 2, query: "Nome" });
    assert.deepEqual(pageRange(2), { from: 10, to: 19 });
    const url = new URL(catalogListUrl(entity, 2, "A&B%"), "http://localhost");
    assert.equal(url.pathname, `/${entity}`); assert.equal(url.searchParams.get("q"), "A&B%");
    assert.equal(escapeLike("%_"), "\\%\\_");
  });
}
test("CPF/CNPJ: vazio opcional, numérico/alfanumérico, máscara e somente formato", () => {
  for (const document of ["", "12345678900", "123.456.789-00", "12345678000100", "12.345.678/0001-00", "12ABC34501DE00", "12.ABC.345/01DE-00", "00000000000"]) {
    assert.equal(supplierSchema.safeParse({ fantasy_name: "Fornecedor", legal_name: "", cnpj_cpf: document }).success, true, document);
  }
  for (const document of ["123", "123456789000", "123.456789-00", "AA.AAA.AAA/AAAA-AA", "12.345.678/0001-000", "<script>"]) {
    assert.equal(supplierSchema.safeParse({ fantasy_name: "Fornecedor", legal_name: "", cnpj_cpf: document }).success, false, document);
  }
});
test("cadastro fora da allowlist nunca acessa repositório", async () => {
  const f = fixture();
  assert.equal((await executeCatalogCommand("usuarios", admin, f.repository, { type: "create", values: { role: "ADMIN" } })).success, false);
  assert.equal(f.calls.length, 0);
});