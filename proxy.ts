import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const publicPath = ["/", "/login", "/forgot-password", "/reset-password", "/auth/callback"].includes(request.nextUrl.pathname);
  if (!env) return publicPath ? response : NextResponse.redirect(new URL("/login?status=configuration", request.url));
  const supabase = createServerClient(env.url, env.key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !publicPath) {
    const destination = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
    return destination;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"] };