import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/0010_academic_lends.sql", import.meta.url), "utf8");
test("0010: três FKs indexadas e CHECKs exclusivos validados, sem relaxar RLS", () => {
  for (const table of ["lendies", "key_lends", "car_key_lends"]) {
    assert.ok(sql.includes(`alter table public.${table} add column academic_id uuid references public.academics(id)`));
    assert.ok(sql.includes(`create index ${table}_academic_id_idx`));
    assert.ok(sql.includes(`${table}_recipient_check\n  check ((collaborator_id is not null) <> (academic_id is not null));`));
    assert.ok(sql.includes(`drop constraint ${table}_rpc_contract`));
  }
  assert.doesNotMatch(sql, /disable row level security|grant\s+(all|insert|update|delete)\b/i);
  assert.match(sql, /begin;/);
  assert.match(sql, /commit;\s*$/);
});
for (const kind of ["product", "key", "car"]) {
  test(`0010 ${kind}: destinatário exclusivo com locks, autorização e retry preservados`, () => {
    const body = sql.split(`create function public.lend_${kind}(`)[1]?.split("end; $$;")[0];
    assert.ok(body);
    assert.match(body, /p_academic_id uuid default null/);
    assert.match(body, /security definer set search_path = ''/);
    assert.match(body, /private.lending_actor\('can_lend'\)/);
    assert.match(body, /\(p_collaborator_id is null\) = \(p_academic_id is null\)/);
    assert.match(body, /from public.academics where id = p_academic_id for key share/);
    assert.match(body, /from public.collaborators where id = p_collaborator_id for key share/);
    assert.match(body, /for update/);
    assert.match(body, /private.lending_retry/);
    assert.match(body, /case when p_academic_id is null then '\{\}'::jsonb/);
    assert.match(body, /collaborator_id,academic_id/);
    assert.match(body, /p_collaborator_id,p_academic_id/);
    assert.match(body, /insert into public.operations/);
    assert.doesNotMatch(body, /exception when|commit;|rollback;/);
  });
}