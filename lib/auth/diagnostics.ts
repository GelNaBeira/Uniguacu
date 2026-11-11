import "server-only";

// Temporário: habilitado automaticamente no dev; nunca imprime sessão/credenciais.
export function authDiagnostic(event: string, fields: Record<string, string | boolean | null | undefined>) {
  if (process.env.NODE_ENV !== "development" && process.env.AUTH_DIAGNOSTICS !== "true") return;
  console.log("[auth-diagnostic]", { event, ...fields });
}