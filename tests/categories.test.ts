import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogPermissions, type PermissionProfile } from "../lib/auth/permissions.ts";
import { categorySchema, categoryIdSchema, categoryError } from "../lib/categories/schema.ts";
import { executeCategoryCommand, type CategoryRepository } from "../lib/categories/service.ts";
import { parseCategoryQuery, pageRange, categoryListUrl, escapeLike } from "../lib/categories/pagination.ts";
import { categorySavedUrl, submitCategory } from "../lib/categories/submission.ts";

const id = "20000000-0000-4000-8000-000000000001";
const admin: PermissionProfile = { role: "ADMIN", is_active: true, limited_access: {} };
const user: PermissionProfile = { role: "USER", is_active: true, limited_access: { version: 1, can_read_inventory: true, can_manage_catalogs: true, can_delete: false } };
function fixture(errorCode?: string, missing = false) {
  const calls: unknown[][] = [];
  const result = { id: missing ? null : id, errorCode };
  const repository: CategoryRepository = {
    create: async (...args) => { calls.push(["create", ...args]); return result; },
    update: async (...args) => { calls.push(["update", ...args]); return result; },
    remove: async (...args) => { calls.push(["delete", ...args]); return result; },
  };
  return { calls, repository };
}

test("schema exige nome não vazio, normaliza bordas e rejeita campos extras", () => {
  for (const name of ["", "   ", "\t\n"]) assert.equal(categorySchema.safeParse({ name }).success, false);
  assert.deepEqual(categorySchema.parse({ name: "  Material didático  " }), { name: "Material didático" });
  assert.equal(categorySchema.safeParse({ name: "Teste", id }).success, false);
  assert.equal(categoryIdSchema.safeParse("invalido").success, false);
  assert.equal(categoryIdSchema.safeParse(id).success, true);
});
test("matriz ADMIN, USER básico e exclusão com flag", () => {
  assert.deepEqual(catalogPermissions(admin), { canRead: true, canManage: true, canDelete: true });
  assert.deepEqual(catalogPermissions(user), { canRead: true, canManage: true, canDelete: false });
  assert.equal(catalogPermissions({ ...user, limited_access: { ...user.limited_access as object, can_delete: true } }).canDelete, true);
});
test("flags inválidas, versão desconhecida e inativo falham fechado", () => {
  for (const limited_access of [null, {}, [], { version: 2, can_read_inventory: true },
    { version: 1, can_read_inventory: "true" }, { version: 1, can_read_inventory: true, unknown: true }]) {
    assert.deepEqual(catalogPermissions({ ...user, limited_access }), { canRead: false, canManage: false, canDelete: false });
  }
  assert.equal(catalogPermissions({ ...admin, is_active: false }).canDelete, false);
  assert.equal(catalogPermissions({ ...user, limited_access: { version: 1, can_delete: true } }).canDelete, false);
  assert.equal(catalogPermissions({ ...user, limited_access: { version: 1, can_read_inventory: true, can_delete: true } }).canDelete, false);
});
test("USER sem can_delete é negado antes de persistir, mesmo chamando comando diretamente", async () => {
  const f = fixture();
  const result = await executeCategoryCommand(user, f.repository, { type: "delete", id });
  assert.equal(result.success, false); assert.equal(f.calls.length, 0);
});
test("USER sem can_manage_catalogs não cria nem edita", async () => {
  const f = fixture(); const restricted = { ...user, limited_access: { version: 1, can_read_inventory: true } };
  for (const command of [{ type: "create", values: { name: "Teste" } }, { type: "update", id, values: { name: "Teste" } }] as const) {
    assert.equal((await executeCategoryCommand(restricted, f.repository, command)).success, false);
  }
  assert.equal(f.calls.length, 0);
});
test("criação e edição persistem apenas nome validado", async () => {
  const f = fixture();
  assert.equal((await executeCategoryCommand(user, f.repository, { type: "create", values: { name: " Teste " } })).success, true);
  assert.equal((await executeCategoryCommand(admin, f.repository, { type: "update", id, values: { name: " Novo " } })).success, true);
  assert.deepEqual(f.calls, [["create", "Teste"], ["update", id, "Novo"]]);
});
test("ADMIN e USER com flag podem excluir; revogação é observada no comando seguinte", async () => {
  const f = fixture();
  assert.equal((await executeCategoryCommand(admin, f.repository, { type: "delete", id })).success, true);
  const allowed = { ...user, limited_access: { ...user.limited_access as object, can_delete: true } };
  assert.equal((await executeCategoryCommand(allowed, f.repository, { type: "delete", id })).success, true);
  assert.equal((await executeCategoryCommand(user, f.repository, { type: "delete", id })).success, false);
  assert.equal(f.calls.length, 2);
});
test("UUID inválido e nome vazio não chegam ao repositório", async () => {
  const f = fixture();
  assert.equal((await executeCategoryCommand(admin, f.repository, { type: "update", id: "x", values: { name: "Teste" } })).success, false);
  assert.equal((await executeCategoryCommand(admin, f.repository, { type: "create", values: { name: " " } })).success, false);
  assert.equal(f.calls.length, 0);
});
test("unicidade, FK, RLS e falha de rede têm mensagens seguras", async () => {
  for (const code of ["23505", "23503", "42501", "23514", "internal"]) {
    const f = fixture(code);
    assert.deepEqual(await executeCategoryCommand(admin, f.repository, { type: "delete", id }), { success: false, message: categoryError(code) });
  }
  const f = fixture(); f.repository.remove = async () => { throw new Error("SQL interno confidencial"); };
  assert.deepEqual(await executeCategoryCommand(admin, f.repository, { type: "delete", id }), { success: false, message: categoryError() });
});
test("zero linhas afetadas não é sucesso", async () => {
  const f = fixture(undefined, true);
  assert.equal((await executeCategoryCommand(admin, f.repository, { type: "delete", id })).success, false);
});
test("paginação é limitada por página e parâmetros são seguros", () => {
  for (const page of ["0", "-1", "abc", "1.5", "999999999999999999999"]) assert.equal(parseCategoryQuery({ page }).page, 1);
  assert.deepEqual(parseCategoryQuery({ page: "2", q: " Papel " }), { page: 2, query: "Papel" });
  assert.deepEqual(parseCategoryQuery({ page: ["1", "2"], q: ["Papel", "Outro"] }), { page: 1, query: "" });
  assert.deepEqual(pageRange(2), { from: 10, to: 19 });
  assert.equal(new URL(categoryListUrl(2, "A&B"), "http://localhost").searchParams.get("q"), "A&B");
  assert.equal(escapeLike("100%_\\"), "100\\%\\_\\\\");
});

test("INSERT com erro RLS não é sucesso e mensagem chega ao formulário sem limpar ou navegar", async () => {
  const f = fixture("42501");
  const events: string[] = [];
  await submitCategory({ name: "Emprestavel" }, false, {
    save: (values) => executeCategoryCommand(admin, f.repository, { type: "create", values }),
    showError: (message) => events.push(message),
    reset: () => events.push("reset"), navigate: () => events.push("navigate"),
  });
  assert.deepEqual(events, [categoryError("42501")]);
  assert.deepEqual(f.calls, [["create", "Emprestavel"]]);
});

test("INSERT sem linha confirmada ou com erro sem código não limpa nem redireciona", async () => {
  for (const dbResult of [{ id: null }, { id, failed: true }]) {
    const events: string[] = [];
    const f = fixture(); f.repository.create = async () => dbResult;
    await submitCategory({ name: "Emprestavel" }, false, {
      save: (values) => executeCategoryCommand(admin, f.repository, { type: "create", values }),
      showError: (message) => events.push(message), reset: () => events.push("reset"), navigate: () => events.push("navigate"),
    });
    assert.equal(events.length, 1); assert.notEqual(events[0], "reset"); assert.notEqual(events[0], "navigate");
  }
});

test("cadastro confirmado limpa e navega para página 1 buscando a categoria salva", async () => {
  const f = fixture(); const events: string[] = [];
  await submitCategory({ name: "Emprestavel" }, false, {
    save: (values) => executeCategoryCommand(admin, f.repository, { type: "create", values }),
    showError: (message) => events.push(message), reset: () => events.push("reset"), navigate: (url) => events.push(url),
  });
  assert.deepEqual(events, ["reset", "/categories?page=1&q=Emprestavel&status=created"]);
});

test("destino pós-edição preserva nome com acentos e caracteres de query sem injeção", () => {
  const url = new URL(categorySavedUrl("  A&B / Empréstimo  ", true), "http://localhost");
  assert.equal(url.pathname, "/categories"); assert.equal(url.searchParams.get("q"), "A&B / Empréstimo");
  assert.equal(url.searchParams.get("page"), "1"); assert.equal(url.searchParams.get("status"), "updated");
});

test("falha de transporte no envio é exibida e preserva os campos", async () => {
  const events: string[] = [];
  await submitCategory({ name: "Emprestavel" }, false, {
    save: async () => { throw new Error("detalhe interno"); },
    showError: (message) => events.push(message), reset: () => events.push("reset"), navigate: () => events.push("navigate"),
  });
  assert.equal(events.length, 1); assert.match(events[0], /Não foi possível confirmar/); assert.doesNotMatch(events[0], /detalhe interno/);
});