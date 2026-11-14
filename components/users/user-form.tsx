"use client";
import { useActionState, useId, useState } from "react";
import { createUser, updateUserAccess } from "@/app/(app)/admin/actions";
import { permissionFlags } from "@/lib/auth/permissions";
import { permissionLabels, type UserRow } from "@/lib/users/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UserForm({ user }: { user?: UserRow }) {
  const id = useId();
  const [role, setRole] = useState(user?.role ?? "USER");
  const [state, action, pending] = useActionState(user ? updateUserAccess : createUser, { success: false, message: "" });
  const access = user?.limited_access && typeof user.limited_access === "object" ? user.limited_access as Record<string, unknown> : {};
  return <form action={action} className="space-y-5" aria-busy={pending}>
    {user && <input type="hidden" name="id" value={user.id} />}
    <fieldset disabled={pending} className="space-y-5">
      {!user && <><div><label htmlFor={`${id}-name`} className="text-sm font-semibold">Nome</label><Input id={`${id}-name`} name="name" minLength={2} maxLength={120} required autoComplete="off" /></div><div><label htmlFor={`${id}-email`} className="text-sm font-semibold">E-mail</label><Input id={`${id}-email`} name="email" type="email" maxLength={254} required autoComplete="off" /></div><div><label htmlFor={`${id}-password`} className="text-sm font-semibold">Senha inicial</label><Input id={`${id}-password`} name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /><p className="mt-2 text-xs text-muted-foreground">Mínimo de 12 caracteres. Entregue por canal seguro. O usuário pode alterar a senha pela recuperação de acesso.</p></div></>}
      <div><label htmlFor={`${id}-role`} className="text-sm font-semibold">Papel</label><select id={`${id}-role`} name="role" value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "USER")} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3"><option value="USER">USER — Usuário</option><option value="ADMIN">ADMIN — Administrador</option></select></div>
      <fieldset className="space-y-3 rounded-lg border border-border p-4"><legend className="px-2 text-sm font-semibold">Permissões (limited_access)</legend><p className="text-xs text-muted-foreground">{role === "ADMIN" ? "ADMIN tem acesso completo; as opções abaixo ficam preservadas para um futuro papel USER." : "Consultar estoque é pré-requisito das operações. Nenhuma permissão é concedida automaticamente."}</p>{permissionFlags.map((flag) => <label key={flag} className="flex items-start gap-3 text-sm"><input name={flag} type="checkbox" defaultChecked={access.version === 1 && access[flag] === true} className="mt-1" />{permissionLabels[flag]}</label>)}</fieldset>
      <Button type="submit">{pending ? "Salvando…" : user ? "Salvar papel e permissões" : "Criar usuário"}</Button>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className="text-sm">{state.message}</p>}
  </form>;
}