"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { emailSchema, loginSchema, resetSchema } from "@/lib/auth/validation";

export async function login(form: FormData) {
  if (!getPublicEnv()) redirect("/login?status=configuration");
  const values = loginSchema.safeParse(Object.fromEntries(form));
  if (!values.success) redirect("/login?status=invalid");
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword(values.data);
  if (error) redirect("/login?status=invalid");
  const { data: { user } } = await client.auth.getUser();
  const { data: profile } = await client.from("usuarios").select("id").eq("id", user?.id ?? "").eq("is_active", true).maybeSingle();
  if (!profile) { await client.auth.signOut(); redirect("/login?status=access"); }
  redirect("/home");
}

export async function forgotPassword(form: FormData) {
  if (!getPublicEnv()) redirect("/forgot-password?status=configuration");
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) redirect("/forgot-password?status=invalid");
  const origin = process.env.APP_URL;
  if (!origin) redirect("/forgot-password?status=configuration");
  const client = await createClient();
  await client.auth.resetPasswordForEmail(email.data, { redirectTo: new URL("/auth/callback", origin).toString() });
  redirect("/forgot-password?status=sent");
}

export async function resetPassword(form: FormData) {
  if (!getPublicEnv()) redirect("/reset-password?status=configuration");
  const values = resetSchema.safeParse(Object.fromEntries(form));
  if (!values.success) redirect("/reset-password?status=invalid");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/forgot-password?status=expired");
  const { error } = await client.auth.updateUser({ password: values.data.password });
  if (error) redirect("/reset-password?status=invalid");
  await client.auth.signOut({ scope: "global" });
  redirect("/login?status=reset");
}

export async function logout() {
  if (getPublicEnv()) { const client = await createClient(); await client.auth.signOut(); }
  redirect("/login");
}