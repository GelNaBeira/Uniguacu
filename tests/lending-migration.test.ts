import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Artefato textual; concorrência é validada separadamente pelo runner PostgreSQL.
const sql = readFileSync(new URL("../supabase/migrations/0009_lending_rpcs.sql", import.meta.url), "utf8");
test("0009: instalação sem LOCK TABLE global, sem ampliar grants do cliente", () => {
  const statements = sql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(statements, /\block\s+table\b/i);
  assert.match(statements, /begin;/);
  assert.match(statements, /commit;\s*$/);
  assert.match(statements, /revoke all privileges on table public\.%I from public, anon, authenticated/);
  assert.doesNotMatch(statements, /grant\s+(?:all|insert|update|delete)\b/i);
});
for (const name of ["lend_product", "return_product", "lend_key", "return_key", "lend_car", "return_car"]) {
  test(`0009 ${name}: SECURITY DEFINER, lock real e histórico atômico`, () => {
    const body = sql.split(`create function public.${name}(`)[1]?.split("end; $$;")[0];
    assert.ok(body);
    assert.match(body, /security definer set search_path = ''/);
    assert.match(body, /private.lending_actor/);
    assert.match(body, /for update/);
    assert.match(body, /insert into public.operations/);
    assert.doesNotMatch(body, /exception when|commit;|rollback;/);
  });
}
test("0009: locks ordenados recurso antes de empréstimo nas devoluções", () => {
  for (const [name, resource, loan] of [["product", "products", "lendies"], ["key", "keys", "key_lends"], ["car", "car_keys", "car_key_lends"]]) {
    const body = sql.split(`create function public.return_${name}(`)[1].split("end; $$;")[0];
    assert.ok(body.indexOf(`from public.${resource} where id = resource_id for update`) < body.indexOf(`from public.${loan} where id = p_lend_id for update`));
  }
});
test("0009: nega DML, restringe helpers, protege retries e unicidade de ativos", () => {
  assert.match(sql, /as restrictive for insert/);
  assert.match(sql, /as restrictive for update/);
  assert.match(sql, /as restrictive for delete/);
  assert.match(sql, /revoke all privileges \(%s\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /operations_lending_request_idx/);
  assert.match(sql, /key_lends_one_active_idx/);
  assert.match(sql, /car_key_lends_one_active_idx/);
  assert.match(sql, /private\.lending_retry\(uuid,text,jsonb\) from public, anon, authenticated/);
});