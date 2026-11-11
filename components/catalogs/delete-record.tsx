"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CatalogResult } from "@/lib/catalogs/schema";

export function DeleteRecord({ id, name, deleteAction }: { id: string; name: string; deleteAction: (id: unknown) => Promise<CatalogResult> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setPending(true); setError("");
    try {
      const result = await deleteAction(id);
      if (!result.success) { setError(result.message); return; }
      dialog.current?.close(); router.refresh();
    } catch { setError("Não foi possível excluir. Verifique sua conexão e sessão e tente novamente."); }
    finally { setPending(false); }
  }
  return <><Button variant="ghost" size="sm" className="text-red-800" aria-label={`Excluir ${name}`} onClick={() => { setError(""); dialog.current?.showModal(); }}>Excluir</Button>
    <dialog ref={dialog} aria-labelledby={`delete-title-${id}`} aria-describedby={`delete-description-${id}`} onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id={`delete-title-${id}`} className="display-heading text-3xl">Excluir cadastro?</h2><p id={`delete-description-${id}`} className="my-5 break-words text-sm leading-6 text-muted-foreground">O registro <strong className="text-foreground">{name}</strong> será excluído permanentemente. Registros com vínculos não podem ser excluídos.</p>
      {error && <p role="alert" className="mb-5 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3"><Button autoFocus variant="outline" disabled={pending} onClick={() => dialog.current?.close()}>Cancelar</Button><Button className="bg-red-800 hover:bg-red-900" disabled={pending} onClick={remove}>{pending ? "Excluindo…" : "Confirmar exclusão"}</Button></div>
    </dialog></>;
}