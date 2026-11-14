/** Static baseline also covers resources/redirects not processed by Proxy. */
export function securityHeaders(production: boolean) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}

export function contentSecurityPolicy(nonce: string, production: boolean, supabaseUrl?: string) {
  // Only an origin from trusted server configuration; never request headers/input.
  let origin = "";
  try {
    const url = new URL(supabaseUrl ?? "");
    if (url.protocol === "https:" || (!production && url.protocol === "http:")) origin = url.origin;
  } catch { /* No external source when configuration is missing/invalid. */ }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    // Radix and existing components use style attributes; scripts remain nonce-only.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${origin ? ` ${origin}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${origin ? ` ${origin}` : ""}${production ? "" : " ws: wss:"}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}