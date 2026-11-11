import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { catalogPermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { categoryListUrl, escapeLike, PAGE_SIZE, pageRange, parseCategoryQuery } from "@/lib/categories/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteCategory } from "@/components/categories/delete-category";

export const metadata = { title: "Categorias" };
export default async function Categories({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[]; status?: string | string[] }> }) {
  const profile = await requireProfile();
  const permissions = catalogPermissions(profile);
  if (!permissions.canRead) return <section><h1 className="display-heading text-4xl">Categorias</h1><p role="alert" className="mt-6">Você não tem permissão para consultar o catálogo. Solicite acesso à administração.</p></section>;
  const params = await searchParams;
  const { page, query } = parseCategoryQuery(params);
  const client = await createClient();
  let countRequest = client.from("categories").select("id", { count: "exact", head: true });
  if (query) countRequest = countRequest.ilike("name", `%${escapeLike(query)}%`);
  const { count, error: countError } = await countRequest;
  if (countError || count === null) throw new Error("Não foi possível consultar as categorias.");
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > pages) redirect(categoryListUrl(pages, query));
  const { from, to } = pageRange(page);
  let request = client.from("categories").select("id,name").order("name").order("id").range(from, to);
  if (query) request = request.ilike("name", `%${escapeLike(query)}%`);
  const { data: categories, error } = await request;
  if (error || !categories) throw new Error("Não foi possível consultar as categorias.");
  const status = params.status === "created" ? "Categoria criada com sucesso." : params.status === "updated" ? "Categoria atualizada com sucesso." : null;
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">CADASTROS / CLASSIFICAÇÃO</p><h1 className="display-heading mt-3 text-5xl">Categorias</h1><p className="mt-3 text-sm text-muted-foreground">Organize as classificações utilizadas no cadastro de produtos.</p></div>{permissions.canManage && <Button asChild><Link href="/categories/new">+ Nova categoria</Link></Button>}</div>
    {status && <p role="status" className="mt-6 rounded-md border border-border bg-muted p-4 text-sm">{status}</p>}
    <form action="/categories" method="get" role="search" className="my-8 flex max-w-lg items-end gap-3"><div className="flex-1 space-y-2"><label htmlFor="category-search" className="text-sm font-semibold">Buscar por nome</label><Input id="category-search" name="q" defaultValue={query} placeholder="Nome da categoria" /></div><Button variant="outline" type="submit">Buscar</Button>{query && <Link href="/categories" className="py-3 text-sm underline">Limpar</Link>}</form>
    <div className="overflow-hidden rounded-xl border border-border bg-card"><Table><caption className="sr-only">Categorias cadastradas, página {page} de {pages}</caption><TableHeader><TableRow><TableHead scope="col">NOME</TableHead><TableHead scope="col" className="text-right">AÇÕES</TableHead></TableRow></TableHeader><TableBody>
      {categories.length === 0 ? <TableRow><TableCell colSpan={2} className="py-16 text-center text-muted-foreground">{query ? "Nenhuma categoria encontrada para esta busca." : "Nenhuma categoria cadastrada."}</TableCell></TableRow> : categories.map((category) => <TableRow key={category.id}><TableCell className="max-w-md break-words font-medium">{category.name}</TableCell><TableCell><div className="flex justify-end gap-2">{permissions.canManage && <Button asChild variant="outline" size="sm"><Link href={`/categories/${category.id}/edit`} aria-label={`Editar categoria ${category.name}`}>Editar</Link></Button>}{permissions.canDelete && <DeleteCategory category={category} />}{!permissions.canManage && <span className="text-xs text-muted-foreground">Somente leitura</span>}</div></TableCell></TableRow>)}
    </TableBody></Table><div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4"><p className="text-xs text-muted-foreground">{count === 0 ? "0 categorias" : `${from + 1}–${Math.min(from + categories.length, count)} de ${count} categorias`}</p><nav aria-label="Paginação de categorias" className="flex items-center gap-3">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={categoryListUrl(page - 1, query)} rel="prev">Anterior</Link></Button> : <Button variant="outline" size="sm" disabled>Anterior</Button>}<span className="text-xs">Página {page} de {pages}</span>{page < pages ? <Button asChild variant="outline" size="sm"><Link href={categoryListUrl(page + 1, query)} rel="next">Próxima</Link></Button> : <Button variant="outline" size="sm" disabled>Próxima</Button>}</nav></div></div>
  </>;
}