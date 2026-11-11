"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Submit({ children, disabled }: { children: React.ReactNode; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" className="mt-2 w-full" disabled={disabled || pending}>{pending ? "Aguarde…" : children}</Button>;
}
export function AuthForm({ action, kind, disabled = false }: { action: (form: FormData) => Promise<void>; kind: "login" | "forgot" | "reset"; disabled?: boolean }) {
  return <form action={action} className="space-y-5">
    {kind !== "reset" && <div className="space-y-2"><label className="text-sm font-semibold" htmlFor="email">E-mail</label><Input id="email" name="email" type="email" autoComplete="email" placeholder="seu.email@instituicao.edu.br" required disabled={disabled} /></div>}
    {kind !== "forgot" && <div className="space-y-2"><label className="text-sm font-semibold" htmlFor="password">{kind === "reset" ? "Nova senha" : "Senha"}</label><Input id="password" name="password" type="password" autoComplete={kind === "reset" ? "new-password" : "current-password"} minLength={kind === "reset" ? 8 : 1} maxLength={4096} required disabled={disabled} /></div>}
    {kind === "reset" && <div className="space-y-2"><label className="text-sm font-semibold" htmlFor="confirmation">Confirmar nova senha</label><Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={4096} required disabled={disabled} /><p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres. A política do servidor também será aplicada.</p></div>}
    <Submit disabled={disabled}>{kind === "login" ? "Entrar no almoxarifado →" : kind === "forgot" ? "Enviar link de recuperação" : "Salvar nova senha"}</Submit>
  </form>;
}