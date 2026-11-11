import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { catalogPermissions } from "@/lib/auth/permissions";
import { CategoryForm } from "@/components/categories/category-form";

export const metadata = { title: "Nova categoria" };
export default async function NewCategory() {
  const profile = await requireProfile();
  if (!catalogPermissions(profile).canManage) return <section><h1 className="display-heading text-4xl">Acesso não permitido</h1><p role="alert" className="my-6">Você não tem permissão para cadastrar categorias.</p><Link href="/categories" className="underline">Voltar às categorias</Link></section>;
  return <><Link href="/categories" className="text-sm text-muted-foreground underline underline-offset-4">← Categorias</Link><h1 className="display-heading mt-6 text-4xl">Nova categoria</h1><p className="mt-3 text-sm text-muted-foreground">Adicione uma classificação para organizar os produtos.</p><CategoryForm /></>;
}