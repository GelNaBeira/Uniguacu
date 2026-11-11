import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { catalogPermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { categoryIdSchema } from "@/lib/categories/schema";
import { CategoryForm } from "@/components/categories/category-form";

export const metadata = { title: "Editar categoria" };
export default async function EditCategory({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (!catalogPermissions(profile).canManage) return <section><h1 className="display-heading text-4xl">Acesso não permitido</h1><p role="alert" className="my-6">Você não tem permissão para editar categorias.</p><Link href="/categories" className="underline">Voltar às categorias</Link></section>;
  const id = categoryIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const client = await createClient();
  const { data: category, error } = await client.from("categories").select("id,name").eq("id", id.data).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a categoria.");
  if (!category) notFound();
  return <><Link href="/categories" className="text-sm text-muted-foreground underline underline-offset-4">← Categorias</Link><h1 className="display-heading mt-6 text-4xl">Editar categoria</h1><p className="mt-3 text-sm text-muted-foreground">Atualize o nome sem alterar os vínculos existentes.</p><CategoryForm category={category} /></>;
}