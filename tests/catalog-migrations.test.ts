import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regressão textual do artefato: não substitui executar SQL/RLS em PostgreSQL.
const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("0004 inclui as quatro policies explícitas e autorização de escrita completa", () => {
  const sql = migration("0004_categories_crud.sql");
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`create policy categories_${operation} on public\\.categories for ${operation} to authenticated`));
  }
  const insert = sql.slice(sql.indexOf("create policy categories_insert"), sql.indexOf("create policy categories_update"));
  assert.match(insert, /with check \(private\.is_admin\(\) or \(private\.has_permission\('can_read_inventory'\) and private\.has_permission\('can_manage_catalogs'\)\)\)/);
  const update = sql.slice(sql.indexOf("create policy categories_update"), sql.indexOf("create policy categories_delete"));
  assert.match(update, /using /); assert.match(update, /with check /);
  const remove = sql.slice(sql.indexOf("create policy categories_delete"), sql.indexOf("-- Pós-condição"));
  for (const flag of ["can_read_inventory", "can_manage_catalogs", "can_delete"]) assert.ok(remove.includes(flag));
  assert.match(sql, /grant insert \(name\), update \(name\)/);
});

test("0005 gera quatro policies para cada uma das quatro entidades com flags de escrita", () => {
  const sql = migration("0005_simple_entities_crud.sql");
  assert.ok(sql.includes("array['sectors','suppliers','collaborators','academics']"));
  for (const operation of ["select", "insert", "update", "delete"]) {
    const line = sql.split("\n").find((line) => line.includes(`for ${operation} to authenticated`));
    assert.ok(line, `Policy ${operation} ausente`);
    assert.ok(line.includes(`t || '_${operation}'`));
    assert.ok(line.includes("private.is_admin()"));
    assert.ok(line.includes("can_read_inventory"));
    if (operation !== "select") assert.ok(line.includes("can_manage_catalogs"));
    if (operation === "delete") assert.ok(line.includes("can_delete"));
    if (operation === "insert" || operation === "update") assert.ok(line.includes("with check"));
    if (operation === "update" || operation === "delete") assert.ok(line.includes("using"));
  }
});

test("0004/0005 verificam completude antes do commit e preservam preflight", () => {
  for (const name of ["0004_categories_crud.sql", "0005_simple_entities_crud.sql"]) {
    const sql = migration(name);
    assert.match(sql, /array\['select','insert','update','delete'\]/);
    assert.ok(sql.includes("p.roles = array['authenticated']::name[]"));
    assert.ok(sql.includes("p.with_check is not null"));
    assert.ok(sql.includes("p.qual is not null"));
    assert.ok(sql.includes("Políticas adicionais"));
    assert.ok(sql.lastIndexOf("raise exception") < sql.lastIndexOf("commit;"));
  }
});