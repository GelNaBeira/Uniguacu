import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "./env";

export async function createClient() {
  const env = getPublicEnv();
  if (!env) throw new Error("Configure as variáveis públicas do Supabase no ambiente local.");
  const store = await cookies();
  return createServerClient(env.url, env.key, { cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
      catch { /* Server Components são somente leitura; proxy renova a sessão. */ }
    },
  } });
}