import { redirect } from "next/navigation";
import { resetPassword } from "../actions";
import { AuthForm } from "@/components/auth-form";
import { AuthNotice } from "@/components/auth-notice";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
export const dynamic = "force-dynamic";
export default async function Reset({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!getPublicEnv()) redirect("/forgot-password?status=configuration");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/forgot-password?status=expired");
  return <><h2 className="display-heading mb-8 text-4xl">Defina sua nova senha.</h2><AuthNotice status={(await searchParams).status} /><AuthForm action={resetPassword} kind="reset" /></>;
}