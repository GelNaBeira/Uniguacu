"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
export function ProductDelete({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [removed, setRemoved] = useState(false);
  function close() { dialog.current?.close(); if (removed) router.refresh(); }
  async function remove() {
    setPending(true); setMessage("");
    try {
      const result = await deleteProduct(id);
      if (!result.success) { setMessage(result.message); return; }
      if (result.warning) { setRemoved(true); setMessage(result.warning); return; }
      dialog.current?.close(); router.refresh();
    } catch { setMessage("Não foi possível concluir. Consulte a listagem antes de repetir a operação."); }
    finally { setPending(false); }
  }
  return <><Button variant="ghost" size="sm" className="text-red-800" aria-label={`Excluir ${name}`} onClick={() => { setMessage(""); dialog.current?.showModal(); }}>Excluir</Button><dialog ref={dialog} aria-labelledby={`delete-product-${id}`} onCancel={(event) => { if (pending) event.preventDefault(); else if (removed) router.refresh(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40"><h2 id={`delete-product-${id}`} className="display-heading text-3xl">{removed ? "Produto excluído" : "Excluir produto?"}</h2>{!removed && <p className="my-5 break-words text-sm leading-6">O produto <strong>{name}</strong> será excluído permanentemente. Produtos com vínculos não podem ser excluídos.</p>}{message && <p role={removed ? "status" : "alert"} className="my-5 text-sm">{message}</p>}<div className="mt-5 flex justify-end gap-3"><Button autoFocus variant="outline" disabled={pending} onClick={close}>{removed ? "Fechar" : "Cancelar"}</Button>{!removed && <Button className="bg-red-800 hover:bg-red-900" disabled={pending} onClick={remove}>{pending ? "Excluindo…" : "Confirmar exclusão"}</Button>}</div></dialog></>;
}