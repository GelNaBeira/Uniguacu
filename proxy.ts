import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { contentSecurityPolicy } from "@/lib/security/headers";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "production", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const requestHeaders = new Headers(request.headers);
  // Overwrite client-supplied CSP/nonce before Next renders scripts.
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);
  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } });
  const secureResponse = (result: NextResponse) => {
    result.headers.set("Content-Security-Policy", csp);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  };
  let response = nextResponse();
  const env = getPublicEnv();
  const publicPath = ["/", "/login", "/forgot-password", "/reset-password", "/auth/callback"].includes(request.nextUrl.pathname);
  if (!env) return secureResponse(publicPath ? response : NextResponse.redirect(new URL("/login?status=configuration", request.url)));
  const supabase = createServerClient(env.url, env.key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      requestHeaders.set("cookie", request.cookies.toString());
      response = nextResponse();
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !publicPath) {
    const destination = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
    return secureResponse(destination);
  }
  return secureResponse(response);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"] };