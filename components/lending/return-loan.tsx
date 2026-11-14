"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { returnItem } from "@/app/(app)/home/actions";
import { returnSchema, type LoanRow, type ReturnInput } from "@/lib/lending/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/components/use-client-ready";

export function ReturnLoan({ loan }: { loan: LoanRow }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const intent = useRef<ReturnInput | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [km, setKm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const ready = useClientReady();
  const router = useRouter();
  const titleId = `return-${loan.kind}-${loan.id}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    const parsed = returnSchema.safeParse(intent.current ?? { kind: loan.kind, loanId: loan.id, ...(loan.kind === "car" ? { kmIn: km === "" ? NaN : Number(km) } : {}) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira os dados."); return; }
    if (parsed.data.kind === "car" && parsed.data.kmIn < (loan.km_out ?? 0)) { setError("O KM de retorno não pode ser inferior ao KM de saída."); return; }
    intent.current = parsed.data;
    inFlight.current = true; setPending(true); setError("");
    try {
      const result = await returnItem(intent.current);
      if (!result.success) { setError(result.message); setUncertain(uncertain || result.uncertain); if (!uncertain && !result.uncertain) intent.current = null; return; }
      intent.current = null; setUncertain(false); dialog.current?.close(); setNotice("Devolução confirmada."); router.refresh();
    } catch { setUncertain(true); setError("Resposta não confirmada. Repita a mesma devolução para confirmar o resultado."); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <>
    <Button variant="outline" size="sm" disabled={!ready} onClick={() => { setError(""); setNotice(""); dialog.current?.showModal(); }} aria-label={`Devolver ${loan.itemName}`}>Devolver</Button>
    {notice && <span role="status" className="text-xs text-primary">{notice}</span>}
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={`${titleId}-description`} onCancel={(e) => { if (pending || uncertain) e.preventDefault(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 text-left text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id={titleId} className="display-heading text-3xl">Confirmar devolução</h2>
      <p id={`${titleId}-description`} className="my-5 text-sm leading-6 text-muted-foreground">Devolução integral de <strong className="text-foreground">{loan.itemName}</strong>, com {loan.recipientName}.{loan.kind === "product" && ` Serão devolvidas ${loan.quantity} unidade(s).`} Esta operação registra o retorno e libera o recurso.</p>
      <form onSubmit={submit} noValidate aria-busy={pending}>
        {loan.kind === "car" && <div className="space-y-2"><label htmlFor={`${titleId}-km`} className="text-sm font-semibold">KM de retorno (obrigatório)</label><Input id={`${titleId}-km`} type="number" min={loan.km_out ?? 0} max={2147483647} step={1} value={km} onChange={(e) => setKm(e.target.value)} disabled={pending || uncertain} /><p className="text-xs text-muted-foreground">KM de saída: {loan.km_out ?? "não informado"}. O banco também confere o odômetro atual.</p></div>}
        {error && <p role="alert" className="my-4 text-sm text-red-800">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3"><Button type="submit" disabled={!ready || pending}>{pending ? "Confirmando…" : uncertain ? "Repetir mesma devolução" : "Confirmar devolução integral"}</Button><Button type="button" variant="outline" disabled={pending || uncertain} onClick={() => { intent.current = null; dialog.current?.close(); }}>Cancelar</Button></div>
      </form>
    </dialog>
  </>;
}