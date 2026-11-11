"use client";
import Link from "next/link";
import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCategory, updateCategory } from "@/app/(app)/categories/actions";
import { categorySchema, type Category, type CategoryValues } from "@/lib/categories/schema";
import { submitCategory } from "@/lib/categories/submission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useClientReady } from "@/components/use-client-ready";
import { preventNativeSubmit } from "@/lib/forms/submission";

export function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const ready = useClientReady();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema), defaultValues: { name: category?.name ?? "" },
  });
  const submit = handleSubmit(async (values) => {
    await submitCategory(values, !!category, {
      save: (data) => category ? updateCategory(category.id, data) : createCategory(data),
      showError: (message) => setError("root", { message }),
      reset: () => reset(),
      navigate: (url) => { router.push(url); router.refresh(); },
    });
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
    <div className="space-y-2"><label htmlFor="category-name" className="text-sm font-semibold">Nome da categoria <span className="text-muted-foreground">(obrigatório)</span></label>
      <Input id="category-name" autoComplete="off" autoFocus aria-invalid={!!errors.name} aria-describedby={errors.name ? "category-name-error" : "category-name-help"} disabled={isSubmitting} {...register("name")} />
      {errors.name ? <p id="category-name-error" role="alert" className="text-sm text-red-800">{errors.name.message}</p> : <p id="category-name-help" className="text-xs text-muted-foreground">Use um nome que identifique a classificação dos produtos.</p>}
    </div>
    {errors.root && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
    <div className="flex flex-wrap gap-3 border-t border-border pt-6"><Button type="submit" disabled={!ready || busy}>{busy ? "Salvando…" : "Salvar categoria"}</Button><Button asChild variant="outline"><Link href="/categories">Cancelar</Link></Button></div>
    </fieldset>
    {!ready && <p role="status" className="mt-4 text-sm text-muted-foreground">Aguardando o formulário ficar pronto. Se esta mensagem persistir, habilite o JavaScript e recarregue a página.</p>}
  </form></Card>;
}