import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "./env";
import { authDiagnostic } from "@/lib/auth/diagnostics";

export async function createClient(diagnosticRequestId?: string) {
  const env = getPublicEnv();
  if (!env) throw new Error("Configure as variáveis públicas do Supabase no ambiente local.");
  const store = await cookies();
  if (diagnosticRequestId) authDiagnostic("supabase.request_cookies", {
    requestId: diagnosticRequestId,
    hasSupabaseAuthCookie: store.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name)),
  });
  return createServerClient(env.url, env.key, { cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
      catch {
        // Server Components são somente leitura; proxy renova a sessão.
        if (diagnosticRequestId) authDiagnostic("supabase.cookie_write_unavailable", { requestId: diagnosticRequestId });
      }
    },
  } });
}