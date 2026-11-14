"use client";
import Image from "next/image";
import { useActionState } from "react";
import { saveProfile, deactivateAccount } from "@/app/(app)/perfil/actions";
import { IMAGE_ACCEPT } from "@/lib/products/image-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial = { success: false, message: "" };
export function ProfileForm({ name, email, photo }: { name: string; email: string; photo: string | null }) {
  const [state, action, pending] = useActionState(saveProfile, initial);
  const [deactivation, deactivate, deactivating] = useActionState(deactivateAccount, initial);
  return <div className="mt-6 space-y-8">
    <form action={action} className="space-y-5" aria-busy={pending}>
      {photo && <Image src={photo} alt="Sua foto de perfil" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" />}
      <p className="break-all text-sm text-muted-foreground">{email}</p>
      <fieldset disabled={pending || deactivating} className="space-y-5">
        <div><label htmlFor="profile-name" className="text-sm font-semibold">Nome</label><Input id="profile-name" name="name" defaultValue={name} minLength={2} maxLength={120} required autoComplete="name" /></div>
        <div><label htmlFor="profile-photo" className="text-sm font-semibold">Foto</label><Input id="profile-photo" name="photo" type="file" accept={IMAGE_ACCEPT} aria-describedby="photo-help" /><p id="photo-help" className="mt-2 text-xs text-muted-foreground">JPEG, PNG ou WebP, até 3 MB. Deixe vazio para manter a foto.</p></div>
        <Button type="submit">{pending ? "Salvando…" : "Salvar perfil"}</Button>
      </fieldset>
      {state.message && <p role={state.success ? "status" : "alert"} className="text-sm">{state.message}</p>}
    </form>
    <section className="rounded-lg border border-red-200 p-5"><h2 className="text-lg font-bold text-red-800">Inativar Conta</h2><p className="my-3 text-sm">Seu acesso será bloqueado e você sairá do sistema. Seus empréstimos e histórico serão preservados. O último administrador ativo não pode ser inativado.</p>
      <form action={deactivate} className="space-y-4" aria-busy={deactivating}><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmation" required disabled={deactivating || pending} className="mt-1" />Confirmo que desejo inativar minha conta e encerrar meu acesso.</label><Button variant="outline" className="text-red-800" disabled={deactivating || pending}>{deactivating ? "Inativando…" : "Inativar Conta"}</Button>{deactivation.message && <p role="alert" className="text-sm text-red-800">{deactivation.message}</p>}</form>
    </section>
  </div>;
}