import Link from "next/link";
import { login } from "../actions";
import { AuthForm } from "@/components/auth-form";
import { AuthNotice } from "@/components/auth-notice";
import { getPublicEnv } from "@/lib/supabase/env";
export default async function Login({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const configured = !!getPublicEnv();
  return <><p className="mb-3 text-xs font-semibold tracking-[.18em] text-muted-foreground">BEM-VINDO DE VOLTA</p><h2 className="display-heading text-4xl">Acesse sua conta.</h2><p className="mb-8 mt-3 text-sm text-muted-foreground">Entre com seu e-mail e senha institucional.</p><AuthNotice status={configured ? status : "configuration"} /><AuthForm action={login} kind="login" disabled={!configured} /><Link href="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-primary underline underline-offset-4">Esqueceu sua senha?</Link></>;
}