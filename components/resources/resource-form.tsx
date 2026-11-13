"use client";
import Link from "next/link";
import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resourceSchema, type ResourceEntity, type ResourceRecord, type ResourceValues, type ResourceResult } from "@/lib/resources/schema";
import { resourceListUrl } from "@/lib/resources/pagination";
import { preventNativeSubmit } from "@/lib/forms/submission";
import { useClientReady } from "@/components/use-client-ready";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function ResourceForm({ entity, record, correctMileage, saveAction }: {
  entity: ResourceEntity; record?: ResourceRecord; correctMileage: boolean;
  saveAction: (values: unknown) => Promise<ResourceResult>;
}) {
  const router = useRouter();
  const ready = useClientReady();
  const [pending, startTransition] = useTransition();
  const mileageEditable = entity === "cars" && (!record || correctMileage);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<ResourceValues>({
    resolver: zodResolver(resourceSchema(entity, !!record, correctMileage)),
    defaultValues: { name: record?.name ?? "", ...(mileageEditable ? { mileage: record ? record.mileage ?? null : 0 } : {}) },
  });
  const busy = pending || isSubmitting;
  const submit = handleSubmit(async (values) => {
    try {
      const result = await saveAction(values);
      if (!result.success) { setError("root", { message: result.message }); return; }
      reset();
      router.push(`${resourceListUrl(entity, 1, values.name.trim())}&result=${record ? "updated" : "created"}`);
      router.refresh();
    } catch { setError("root", { message: "Não foi possível confirmar o salvamento. Consulte a listagem antes de repetir a operação." }); }
  });
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    preventNativeSubmit(event, startTransition, async () => {
      if (!ready || busy) return;
      try { await submit(); } catch { setError("root", { message: "Não foi possível enviar o formulário. Tente novamente." }); }
    });
  }
  return <Card className="mt-8 max-w-2xl p-6 sm:p-8"><form method="post" onSubmit={onSubmit} noValidate aria-busy={busy}>
    <fieldset disabled={!ready || busy} className="space-y-6">
      <div className="space-y-2"><label htmlFor="resource-name" className="text-sm font-semibold">Nome (obrigatório)</label><Input id="resource-name" autoFocus autoComplete="off" aria-invalid={!!errors.name} aria-describedby={errors.name ? "resource-name-error" : undefined} {...register("name")} />{errors.name && <p id="resource-name-error" role="alert" className="text-sm text-red-800">{errors.name.message}</p>}</div>
      <div className="space-y-2"><label htmlFor="resource-status" className="text-sm font-semibold">Status</label><Input id="resource-status" value={(record?.status ?? "DISPONIVEL") === "DISPONIVEL" ? "Disponível" : "Indisponível"} disabled aria-describedby="resource-status-help" /><p id="resource-status-help" className="text-xs leading-5 text-muted-foreground">O status inicial é sempre disponível e só pode ser alterado através dos empréstimos.</p></div>
      {entity === "cars" && <div className="space-y-2"><label htmlFor="resource-mileage" className="text-sm font-semibold">Quilometragem (km, opcional)</label>{mileageEditable ? <Input id="resource-mileage" type="number" min={0} max={2147483647} step={1} aria-invalid={!!errors.mileage} aria-describedby={errors.mileage ? "resource-mileage-error resource-mileage-help" : "resource-mileage-help"} {...register("mileage", { setValueAs: (value: string) => value === "" ? null : Number(value) })} /> : <Input id="resource-mileage" value={record?.mileage ?? ""} disabled aria-describedby="resource-mileage-help" />}<p id="resource-mileage-help" className="text-xs leading-5 text-muted-foreground">A quilometragem será atualizada automaticamente nos empréstimos. Somente ADMIN pode corrigir este valor na edição.</p>{errors.mileage && <p id="resource-mileage-error" role="alert" className="text-sm text-red-800">{errors.mileage.message}</p>}</div>}
      {errors.root && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6"><Button type="submit" disabled={!ready || busy}>{busy ? "Salvando…" : "Salvar cadastro"}</Button><Button asChild variant="outline"><Link href={`/${entity}`}>Cancelar</Link></Button></div>
    </fieldset>
    {!ready && <p role="status" className="mt-4 text-sm text-muted-foreground">Aguardando o formulário ficar pronto. Se esta mensagem persistir, habilite o JavaScript e recarregue a página.</p>}
  </form></Card>;
}