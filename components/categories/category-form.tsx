"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCategory, updateCategory } from "@/app/(app)/categories/actions";
import { categorySchema, type Category, type CategoryValues } from "@/lib/categories/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema), defaultValues: { name: category?.name ?? "" },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = category ? await updateCategory(category.id, values) : await createCategory(values);
      if (!result.success) { setError("root", { message: result.message }); return; }
      router.push(`/categories?status=${category ? "updated" : "created"}`);
      router.refresh();
    } catch { setError("root", { message: "Não foi possível salvar. Verifique sua conexão e sessão e tente novamente." }); }
  });
  return <Card className="mt-8 max-w-2xl p-6 sm:p-8"><form onSubmit={onSubmit} noValidate className="space-y-6">
    <div className="space-y-2"><label htmlFor="category-name" className="text-sm font-semibold">Nome da categoria <span className="text-muted-foreground">(obrigatório)</span></label>
      <Input id="category-name" autoComplete="off" autoFocus aria-invalid={!!errors.name} aria-describedby={errors.name ? "category-name-error" : "category-name-help"} disabled={isSubmitting} {...register("name")} />
      {errors.name ? <p id="category-name-error" role="alert" className="text-sm text-red-800">{errors.name.message}</p> : <p id="category-name-help" className="text-xs text-muted-foreground">Use um nome que identifique a classificação dos produtos.</p>}
    </div>
    {errors.root && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
    <div className="flex flex-wrap gap-3 border-t border-border pt-6"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar categoria"}</Button><Button asChild variant="outline"><Link href="/categories">Cancelar</Link></Button></div>
  </form></Card>;
}