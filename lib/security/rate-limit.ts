export type RateLimitScope = "reports" | "lending";
export const rateLimitMessage = "Muitas solicitações. Aguarde alguns segundos antes de tentar novamente.";

/** A separate, committed RPC request makes quotas survive concurrent actions/instances. */
export async function checkRateLimit(scope: RateLimitScope, consume: (scope: RateLimitScope) => Promise<{ data: unknown; error: unknown }>) {
  try {
    const { data, error } = await consume(scope);
    if (error || typeof data !== "boolean") return { allowed: false, message: "Proteção de requisições indisponível. Tente novamente mais tarde." };
    return { allowed: data, message: data ? "" : rateLimitMessage };
  } catch {
    return { allowed: false, message: "Proteção de requisições indisponível. Tente novamente mais tarde." };
  }
}