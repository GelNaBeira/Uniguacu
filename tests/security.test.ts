import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { contentSecurityPolicy, securityHeaders } from "../lib/security/headers.ts";
import { checkRateLimit } from "../lib/security/rate-limit.ts";

test("headers: baseline cobre CSP, clickjacking, MIME, referrer e HSTS apenas em produção", () => {
  const headers = Object.fromEntries(securityHeaders(true).map(({ key, value }) => [key, value]));
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.ok(!securityHeaders(false).some(({ key }) => key === "Strict-Transport-Security"));
});

test("CSP: produção exige nonce de script, sem eval/wildcard e com origem Supabase exata", () => {
  const csp = contentSecurityPolicy("unique-nonce", true, "https://example.supabase.co/storage/v1");
  const script = csp.split(";").find((value) => value.trim().startsWith("script-src"))!;
  assert.match(script, /'nonce-unique-nonce' 'strict-dynamic'/);
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval|\*/);
  assert.match(csp, /connect-src 'self' https:\/\/example.supabase.co;/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.doesNotMatch(csp, /\/storage\/v1/);
  for (const origin of [undefined, "javascript:alert(1)", "http://example.org"]) {
    assert.match(contentSecurityPolicy("n", true, origin), /connect-src 'self';/);
  }
  assert.match(contentSecurityPolicy("n", false), /'unsafe-eval'/);
  assert.doesNotMatch(contentSecurityPolicy("n", false), /upgrade-insecure-requests/);
});

test("rate limit: rejeita quota excedida, falha de RPC e resposta inválida sem fail-open", async () => {
  assert.equal((await checkRateLimit("reports", async (scope) => {
    assert.equal(scope, "reports"); return { data: true, error: null };
  })).allowed, true);
  for (const result of [{ data: false, error: null }, { data: null, error: null },
    { data: true, error: { code: "42501" } }, { data: "true", error: null }]) {
    assert.equal((await checkRateLimit("lending", async () => result)).allowed, false);
  }
  const failure = await checkRateLimit("reports", async () => { throw new Error("private SQL secret"); });
  assert.equal(failure.allowed, false);
  assert.doesNotMatch(failure.message, /SQL|secret/);
});

test("integração: limiter precede trabalho caro e SQL não aceita identidade/quota do cliente", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const reports = read("app/(app)/reports/actions.ts");
  const lending = read("app/(app)/home/actions.ts");
  assert.ok(reports.indexOf('enforceRateLimit("reports")') < reports.indexOf("return executeReport"));
  assert.ok(lending.indexOf('enforceRateLimit("lending")') < lending.indexOf("await executeLendingCommand"));
  const sql = read("supabase/migrations/0015_security_hardening.sql");
  assert.match(sql, /actor uuid := auth.uid\(\)/);
  assert.match(sql, /where id = actor and is_active/);
  assert.match(sql, /on conflict \(user_id,scope\) do update/);
  assert.match(sql, /alter table private.action_rate_limits enable row level security/);
  assert.match(sql, /revoke execute on function public.rls_auto_enable\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public.consume_action_rate_limit\(text\) to authenticated/);
  assert.match(sql, /create function public.consume_action_rate_limit\(p_scope text\)/);
  assert.match(read("proxy.ts"), /requestHeaders.set\("x-nonce", nonce\)/);
  assert.match(read("app/layout.tsx"), /await connection\(\)/);
});

test("React: aplicação não injeta HTML bruto nem avalia código do usuário", () => {
  for (const folder of ["app", "components", "lib"]) {
    for (const path of readdirSync(new URL(`../${folder}/`, import.meta.url), { recursive: true, encoding: "utf8" })) {
      if (!/\.tsx?$/.test(path)) continue;
      const source = readFileSync(new URL(`../${folder}/${path.replaceAll("\\", "/")}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new Function\s*\(/, path);
    }
  }
});