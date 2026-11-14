"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { lendItem } from "@/app/(app)/home/actions";
import { kindLabels, kinds, lendSchema, selectedLendError, type LendInput, type LendingKind, type LendingOption } from "@/lib/lending/schema";
import { useClientReady } from "@/components/use-client-ready";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OptionPicker } from "./option-picker";

export function NewLoan({ initialResource, initialKind = "product", triggerLabel = "+ Novo empréstimo", triggerClassName }: { initialResource?: LendingOption; initialKind?: LendingKind; triggerLabel?: string; triggerClassName?: string }) {
  const formId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const intent = useRef<LendInput | null>(null);
  const requestId = useRef<string | null>(null);
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LendingKind>(initialKind);
  const [resource, setResource] = useState<LendingOption | null>(initialResource ?? null);
  const [recipientType, setRecipientType] = useState<"collaborator" | "academic">("collaborator");
  const [recipient, setRecipient] = useState<LendingOption | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [kmOut, setKmOut] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function show() {
    setNotice("");
    setKind(initialKind); setResource(initialResource ?? null);
    if (!requestId.current) requestId.current = uuidv4();
    setOpen(true); dialog.current?.showModal();
  }
  function close() {
    if (inFlight.current || uncertain) return;
    requestId.current = null; intent.current = null; setError(""); setOpen(false); dialog.current?.close();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    setError("");
    if (!intent.current) {
      const input = { kind, resourceId: resource?.id,
        collaboratorId: recipientType === "collaborator" ? recipient?.id : null,
        academicId: recipientType === "academic" ? recipient?.id : null, requestId: requestId.current,
        ...(kind === "product" ? { quantity: quantity === "" ? NaN : Number(quantity) } : kind === "car" ? { kmOut: kmOut === "" ? NaN : Number(kmOut) } : {}) };
      const parsed = lendSchema.safeParse(input);
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira os campos obrigatórios."); return; }
      const selectionError = selectedLendError(parsed.data, resource);
      if (selectionError) { setError(selectionError); return; }
      intent.current = parsed.data;
    }
    inFlight.current = true; setPending(true);
    try {
      const result = await lendItem(intent.current);
      if (!result.success) {
        // Uma negativa posterior não esclarece uma confirmação perdida anterior
        // (por exemplo, permissão revogada depois do COMMIT da primeira tentativa).
        setError(result.message); setUncertain(uncertain || result.uncertain);
        if (!uncertain && !result.uncertain) { intent.current = null; requestId.current = uuidv4(); }
        return;
      }
      intent.current = null; requestId.current = null; setUncertain(false);
      setResource(null); setRecipient(null); setRecipientType("collaborator"); setQuantity("1"); setKmOut("");
      setNotice("Empréstimo registrado com sucesso."); setOpen(false); dialog.current?.close(); router.refresh();
    } catch { setUncertain(true); setError("Resposta não confirmada. Use Repetir mesma tentativa para consultar o resultado sem duplicar a retirada."); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <>
    <Button className={triggerClassName} disabled={!ready} onClick={show}>{triggerLabel}</Button>
    {notice && <p role="status" className="text-sm font-semibold text-primary">{notice}</p>}
    <dialog ref={dialog} aria-labelledby={`${formId}-new-loan-title`} aria-describedby={`${formId}-new-loan-description`} onCancel={(e) => { e.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40 sm:p-8">
      <p className="text-xs font-semibold tracking-[.16em] text-muted-foreground">REGISTRAR SAÍDA</p>
      <h2 id={`${formId}-new-loan-title`} className="display-heading mt-2 text-3xl">Novo empréstimo</h2>
      <p id={`${formId}-new-loan-description`} className="mb-6 mt-3 text-sm leading-6 text-muted-foreground">Selecione o recurso e o colaborador ou acadêmico responsável. O estoque e a disponibilidade serão conferidos novamente no banco.</p>
      <form onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending || uncertain} className="space-y-5">
          <div className="space-y-2"><label htmlFor={`${formId}-loan-kind`} className="text-sm font-semibold">Tipo de item</label><Select id={`${formId}-loan-kind`} value={kind} onChange={(e) => { setKind(e.target.value as LendingKind); setResource(null); setKmOut(""); setError(""); }}>{kinds.map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}</Select></div>
          {open && <OptionPicker key={kind} kind={kind} label={kindLabels[kind]} value={resource} onChange={setResource} disabled={pending || uncertain} />}
          <div className="space-y-2"><label htmlFor={`${formId}-loan-recipient-type`} className="text-sm font-semibold">Tipo de destinatário</label><Select id={`${formId}-loan-recipient-type`} value={recipientType} onChange={(e) => { setRecipientType(e.target.value as "collaborator" | "academic"); setRecipient(null); setError(""); }}><option value="collaborator">Colaborador</option><option value="academic">Acadêmico</option></Select></div>
          {open && <OptionPicker key={recipientType} kind={recipientType} label={recipientType === "academic" ? "Acadêmico" : "Colaborador"} value={recipient} onChange={setRecipient} disabled={pending || uncertain} />}
          {kind === "product" && <div className="space-y-2"><label htmlFor={`${formId}-quantity`} className="text-sm font-semibold">Quantidade (obrigatória)</label><Input id={`${formId}-quantity`} type="number" min={1} max={resource?.qtd ?? 2147483647} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} /><p className="text-xs text-muted-foreground">Estoque consultado: {resource?.qtd ?? "selecione um produto"}. {resource?.is_consumable ? "Consumível: baixa definitiva, sem devolução." : "Devolução sempre integral."}</p></div>}
          {kind === "car" && <div className="space-y-2"><label htmlFor={`${formId}-loan-km`} className="text-sm font-semibold">KM de saída (obrigatório)</label><Input id={`${formId}-loan-km`} type="number" min={resource?.mileage ?? 0} max={2147483647} step={1} value={kmOut} onChange={(e) => setKmOut(e.target.value)} /><p className="text-xs text-muted-foreground">Odômetro cadastrado: {resource?.mileage ?? "não informado"} km.</p></div>}
        </fieldset>
        {error && <p role="alert" className="my-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {uncertain && <p role="status" className="my-4 text-sm">Os dados e o UUID desta tentativa estão preservados. Não feche ou recarregue a página até confirmar o resultado.</p>}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5"><Button type="submit" disabled={!ready || pending}>{pending ? "Confirmando…" : uncertain ? "Repetir mesma tentativa" : "Confirmar empréstimo"}</Button><Button type="button" variant="outline" disabled={pending || uncertain} onClick={close}>Cancelar</Button></div>
      </form>
    </dialog>
  </>;
}
