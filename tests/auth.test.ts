import { test } from "node:test";
import assert from "node:assert/strict";
import { loginSchema, emailSchema, resetSchema } from "../lib/auth/validation.ts";
import { getPublicEnv } from "../lib/supabase/env.ts";

test("login valida e-mail e não altera senha", () => {
  assert.equal(loginSchema.safeParse({ email: "invalido", password: "senha" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "a@example.org", password: "" }).success, false);
  const value = loginSchema.parse({ email: " a@example.org ", password: " senha " });
  assert.equal(value.password, " senha ");
  assert.equal(value.email, "a@example.org");
});
test("recuperação rejeita email ausente", () => assert.equal(emailSchema.safeParse(null).success, false));
test("reset exige confirmação igual e oito caracteres", () => {
  assert.equal(resetSchema.safeParse({ password: "123", confirmation: "123" }).success, false);
  assert.equal(resetSchema.safeParse({ password: "12345678", confirmation: "diferente" }).success, false);
  assert.equal(resetSchema.safeParse({ password: "SenhaLonga!", confirmation: "SenhaLonga!" }).success, true);
});
test("ambiente ausente ou URL insegura falha fechado", () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal(getPublicEnv(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "sb_publishable_test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    assert.equal(getPublicEnv(), null);
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";
    assert.equal(getPublicEnv(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "javascript:alert(1)";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
    assert.equal(getPublicEnv(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    assert.ok(getPublicEnv());
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";
    assert.deepEqual(getPublicEnv(), { url: "https://example.supabase.co", key: "sb_publishable_test" });
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});