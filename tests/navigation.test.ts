import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { canViewAdministration, isNavigationActive, navigationGroups } from "../lib/navigation.ts";

test("menu organiza os cadastros nos submenus solicitados e usa rotas existentes", () => {
  assert.deepEqual(navigationGroups.map((group) => [group.label, group.items.map((item) => item.label)]), [
    ["Produtos", ["Lista", "Categorias", "Setores", "Fornecedores"]],
    ["Pessoas", ["Colaboradores", "Acadêmicos"]],
    ["Patrimônio", ["Chaves", "Carros"]],
  ]);
  for (const group of navigationGroups) for (const item of group.items) {
    assert.ok(existsSync(new URL(`../app/(app)${item.href}/page.tsx`, import.meta.url)), item.href);
  }
});
test("rota ativa inclui criação e edição sem confundir prefixos", () => {
  assert.equal(isNavigationActive("/keys", "/keys"), true);
  assert.equal(isNavigationActive("/keys/new", "/keys"), true);
  assert.equal(isNavigationActive("/cars/123/edit", "/cars"), true);
  assert.equal(isNavigationActive("/product-codes", "/products"), false);
  assert.equal(isNavigationActive("/keys-other", "/keys"), false);
});
test("administração é visível exclusivamente para ADMIN", () => {
  assert.equal(canViewAdministration("ADMIN"), true);
  for (const role of ["USER", "", "admin", "UNKNOWN"]) assert.equal(canViewAdministration(role), false);
});