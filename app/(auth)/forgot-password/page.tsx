import Link from "next/link";
import { forgotPassword } from "../actions";
import { AuthForm } from "@/components/auth-form";
import { AuthNotice } from "@/components/auth-notice";
import { getPublicEnv } from "@/lib/supabase/env";
export default async function Forgot({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const configured = !!getPublicEnv();
  return <><h2 className="display-heading text-4xl">Recupere seu acesso.</h2><p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">Informe seu e-mail para receber um link de redefinição de senha.</p><AuthNotice status={configured ? status : "configuration"} /><AuthForm action={forgotPassword} kind="forgot" disabled={!configured} /><Link className="mt-6 inline-block text-sm underline" href="/login">← Voltar ao login</Link></>;
}