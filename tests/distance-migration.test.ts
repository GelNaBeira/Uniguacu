import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regressão textual: não comprova execução SQL, locks ou dependências reais.
const sql = readFileSync(new URL("../supabase/migrations/0008_fix_distance.sql", import.meta.url), "utf8");

test("0008 usa a regra NULL aprovada nos dois caminhos e na pós-condição", () => {
  assert.equal(sql.match(/CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END/g)?.length, 3);
  assert.doesNotMatch(sql, /coalesce\s*\(/i);
  assert.match(sql, /distance is distinct from/);
});

test("0008 preserva expressão gerada no PG17+ e protege fallback sem cascata", () => {
  assert.match(sql, /server_version_num.*>= 170000/);
  assert.match(sql, /alter column distance set expression as/);
  assert.match(sql, /distance_column.attgenerated <> 's'/);
  assert.match(sql, /from pg_depend/);
  assert.match(sql, /distance_column.attacl is not null/);
  assert.match(sql, /drop column distance restrict/);
  assert.match(sql, /add column distance integer generated always as/);
  assert.doesNotMatch(sql, /drop\s+(?:column|table).*cascade/i);
  assert.doesNotMatch(sql, /disable row level security|grant\s|delete from|truncate\s/i);
});

test("0008 mantém preflight e pós-condição na mesma transação com lock limitado", () => {
  assert.match(sql, /begin;[\s\S]*set local lock_timeout = '5s'/);
  assert.ok(sql.indexOf("lock table") < sql.indexOf("select a.attnum"));
  assert.ok(sql.indexOf("from pg_depend") < sql.indexOf("drop column distance"));
  assert.match(sql, /analyze public.car_key_lends \(distance\);\s*commit;\s*$/);
});