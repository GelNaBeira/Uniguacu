"use client";
import Link from "next/link";
import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { catalogs, type CatalogEntity, type CatalogRecord, type CatalogResult, type CatalogValues } from "@/lib/catalogs/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useClientReady } from "@/components/use-client-ready";
import { preventNativeSubmit } from "@/lib/forms/submission";

export type CatalogSaveAction = (values: unknown) => Promise<CatalogResult>;
export function CatalogForm({ entity, record, saveAction }: { entity: CatalogEntity; record?: CatalogRecord; saveAction: CatalogSaveAction }) {
  const config = catalogs[entity];
  const router = useRouter();
  const ready = useClientReady();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CatalogValues>({
    resolver: zodResolver(config.schema), defaultValues: Object.fromEntries(config.fields.map((field) => [field.name, record?.[field.name] ?? ""])),
  });
  const submit = handleSubmit(async (values) => {
    try {
      const result = await saveAction(values);
      if (!result.success) { setError("root", { message: result.message }); return; }
      router.push(`/${entity}?status=${record ? "updated" : "created"}`);
      router.refresh();
    } catch { setError("root", { message: "Não foi possível salvar. Verifique sua conexão e sessão e tente novamente." }); }
  });
  const busy = isSubmitting || isPending;
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    preventNativeSubmit(event, startTransition, async () => {
      if (!ready || busy) return;
      try { await submit(); }
      catch { setError("root", { message: "Não foi possível enviar o formulário. Recarregue a página e tente novamente." }); }
    });
  }
  return <Card className="mt-8 max-w-2xl p-6 sm:p-8"><form method="post" onSubmit={onSubmit} noValidate aria-busy={busy}>
    <fieldset disabled={!ready || busy} className="space-y-6">
    {config.fields.map((field, index) => {
      const id = `${entity}-${field.name}`;
      const error = errors[field.name];
      return <div key={field.name} className="space-y-2"><label htmlFor={id} className="text-sm font-semibold">{field.label} <span className="text-muted-foreground">({field.required ? "obrigatório" : "opcional"})</span></label>
        <Input id={id} autoComplete="off" autoFocus={index === 0} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : field.help ? `${id}-help` : undefined} disabled={isSubmitting} {...register(field.name)} />
        {error ? <p id={`${id}-error`} role="alert" className="text-sm text-red-800">{String(error.message ?? "Confira o campo.")}</p> : field.help ? <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{field.help}</p> : null}
      </div>;
    })}
    {errors.root && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
    <div className="flex flex-wrap gap-3 border-t border-border pt-6"><Button type="submit" disabled={!ready || busy}>{busy ? "Salvando…" : "Salvar cadastro"}</Button><Button asChild variant="outline"><Link href={`/${entity}`}>Cancelar</Link></Button></div>
    </fieldset>
    {!ready && <p role="status" className="mt-4 text-sm text-muted-foreground">Aguardando o formulário ficar pronto. Se esta mensagem persistir, habilite o JavaScript e recarregue a página.</p>}
  </form></Card>;
}