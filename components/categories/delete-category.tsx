"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/app/(app)/categories/actions";
import type { Category } from "@/lib/categories/schema";
import { Button } from "@/components/ui/button";

export function DeleteCategory({ category }: { category: Category }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setPending(true); setError("");
    try {
      const result = await deleteCategory(category.id);
      if (!result.success) { setError(result.message); return; }
      dialog.current?.close();
      router.refresh();
    } catch { setError("Não foi possível excluir. Verifique sua conexão e sessão e tente novamente."); }
    finally { setPending(false); }
  }
  return <><Button variant="ghost" size="sm" className="text-red-800" aria-label={`Excluir categoria ${category.name}`} onClick={() => { setError(""); dialog.current?.showModal(); }}>Excluir</Button>
    <dialog ref={dialog} aria-labelledby={`delete-title-${category.id}`} aria-describedby={`delete-description-${category.id}`} onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id={`delete-title-${category.id}`} className="display-heading text-3xl">Excluir categoria?</h2><p id={`delete-description-${category.id}`} className="my-5 break-words text-sm leading-6 text-muted-foreground">A categoria <strong className="text-foreground">{category.name}</strong> será excluída permanentemente. Categorias vinculadas a produtos não podem ser excluídas.</p>
      {error && <p role="alert" className="mb-5 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3"><Button autoFocus variant="outline" disabled={pending} onClick={() => dialog.current?.close()}>Cancelar</Button><Button className="bg-red-800 hover:bg-red-900" disabled={pending} onClick={remove}>{pending ? "Excluindo…" : "Confirmar exclusão"}</Button></div>
    </dialog></>;
}