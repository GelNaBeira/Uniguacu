"use client";
import { useActionState } from "react";
import { deactivateUser } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

export function DeactivateUserForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deactivateUser, { success: false, message: "" });
  return <form action={action} className="mt-5 space-y-3 border-t border-border pt-4" aria-busy={pending}>
    <input type="hidden" name="id" value={id} />
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmation" required disabled={pending} className="mt-1" />Confirmo a inativação de {name}. O acesso será bloqueado e o histórico preservado.</label>
    <Button type="submit" variant="outline" className="text-red-800" disabled={pending}>{pending ? "Inativando…" : "Inativar"}</Button>
    {state.message && <p role={state.success ? "status" : "alert"} className="text-sm">{state.message}</p>}
  </form>;
}