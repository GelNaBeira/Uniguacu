"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "./env";
export function createClient() {
  const env = getPublicEnv();
  if (!env) throw new Error("Supabase não configurado.");
  return createBrowserClient(env.url, env.key);
}