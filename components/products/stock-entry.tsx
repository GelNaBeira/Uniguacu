"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { addStock } from "@/app/(app)/products/actions";
import { stockEntrySchema, type StockEntryInput } from "@/lib/products/stock";
import { useClientReady } from "@/components/use-client-ready";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StockEntry({ productId, name }: { productId: string; name: string }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const intent = useRef<StockEntryInput | null>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const router = useRouter();
  const ready = useClientReady();
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function close() { if (!inFlight.current && !uncertain) { dialog.current?.close(); requestId.current = null; intent.current = null; setError(""); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    const form = event.currentTarget;
    if (!intent.current) {
      const data = new FormData(form);
      const parsed = stockEntrySchema.safeParse({ productId, requestId: requestId.current, quantity: Number(data.get("quantity")), date: data.get("date"), note: data.get("note") });
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira os campos."); return; }
      intent.current = parsed.data;
    }
    inFlight.current = true; setPending(true); setError("");
    try {
      const result = await addStock(intent.current);
      if (!result.success) {
        setError(result.message); setUncertain(uncertain || result.uncertain);
        if (!uncertain && !result.uncertain) { intent.current = null; requestId.current = uuidv4(); }
        return;
      }
      setUncertain(false); intent.current = null; requestId.current = null; form.reset(); dialog.current?.close(); setNotice("Entrada registrada."); router.refresh();
    } catch { setUncertain(true); setError("Resposta não confirmada. Repita a mesma tentativa sem recarregar a página."); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <div><Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={!ready} onClick={() => { requestId.current ??= uuidv4(); setNotice(""); dialog.current?.showModal(); }}>Entrada no Estoque</Button>{notice && <p role="status" className="mt-1 text-xs text-emerald-800">{notice}</p>}
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id={`${id}-title`} className="display-heading text-3xl">Entrada no estoque</h2><p className="mb-6 mt-3 text-sm text-muted-foreground">{name}</p>
      <form onSubmit={submit} aria-busy={pending}><fieldset disabled={pending || uncertain} className="space-y-4"><div><label htmlFor={`${id}-quantity`} className="text-sm font-semibold">Quantidade</label><Input id={`${id}-quantity`} name="quantity" type="number" min={1} max={2147483647} step={1} required /></div><div><label htmlFor={`${id}-date`} className="text-sm font-semibold">Data da entrada</label><Input id={`${id}-date`} name="date" type="date" required /></div><div><label htmlFor={`${id}-note`} className="text-sm font-semibold">Nota / observação (opcional)</label><textarea id={`${id}-note`} name="note" maxLength={2000} rows={3} className="w-full rounded-md border border-input p-3" /></div></fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}{uncertain && <p className="mt-3 text-sm">Os dados foram preservados. Não feche nem recarregue até confirmar.</p>}
        <div className="mt-6 flex gap-3"><Button disabled={pending || !ready}>{pending ? "Confirmando…" : uncertain ? "Repetir mesma tentativa" : "Confirmar entrada"}</Button><Button type="button" variant="outline" disabled={pending || uncertain} onClick={close}>Cancelar</Button></div>
      </form>
    </dialog>
  </div>;
}