import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { catalogPermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { catalogs, catalogIdSchema, type CatalogEntity, type CatalogRecord, type CatalogResult } from "@/lib/catalogs/schema";
import { catalogListUrl, escapeLike, PAGE_SIZE, pageRange, parseCatalogQuery } from "@/lib/catalogs/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CatalogForm, type CatalogSaveAction } from "./catalog-form";
import { DeleteRecord } from "./delete-record";

export type CatalogSearchParams = Promise<{ page?: string | string[]; q?: string | string[]; status?: string | string[] }>;
export type CatalogEditParams = Promise<{ id: string }>;
function Denied({ entity }: { entity: CatalogEntity }) {
  return <section><h1 className="display-heading text-4xl">Acesso não permitido</h1><p role="alert" className="my-6">Você não tem permissão para esta operação.</p><Link href={`/${entity}`} className="underline">Voltar a {catalogs[entity].title.toLowerCase()}</Link></section>;
}

export async function CatalogListPage({ entity, searchParams, deleteAction }: { entity: CatalogEntity; searchParams: CatalogSearchParams; deleteAction: (id: unknown) => Promise<CatalogResult> }) {
  const permissions = catalogPermissions(await requireProfile());
  const config = catalogs[entity];
  if (!permissions.canRead) return <Denied entity={entity} />;
  const params = await searchParams;
  const { page, query } = parseCatalogQuery(params);
  const client = await createClient();
  let countRequest = client.from(entity).select("id", { count: "exact", head: true });
  if (query) countRequest = countRequest.ilike(config.nameColumn, `%${escapeLike(query)}%`);
  const { count, error: countError } = await countRequest;
  if (countError || count === null) throw new Error("Não foi possível consultar o catálogo.");
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > pages) redirect(catalogListUrl(entity, pages, query));
  const { from, to } = pageRange(page);
  // Colunas são uma allowlist estática; nenhum identificador vem da query do navegador.
  const columns = ["id", ...config.fields.map((field) => field.name)].join(",");
  let request = client.from(entity).select(columns).order(config.nameColumn).order("id").range(from, to);
  if (query) request = request.ilike(config.nameColumn, `%${escapeLike(query)}%`);
  const { data, error } = await request;
  if (error || !data) throw new Error("Não foi possível consultar o catálogo.");
  const records = data as unknown as CatalogRecord[];
  const status = params.status === "created" ? "Cadastro criado com sucesso." : params.status === "updated" ? "Cadastro atualizado com sucesso." : null;
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">CADASTROS / ALMOXARIFADO</p><h1 className="display-heading mt-3 text-5xl">{config.title}</h1><p className="mt-3 text-sm text-muted-foreground">Consulte e mantenha os cadastros de {config.title.toLowerCase()}.</p></div>{permissions.canManage && <Button asChild><Link href={`/${entity}/new`}>+ {config.newTitle}</Link></Button>}</div>
    {status && <p role="status" className="mt-6 rounded-md border border-border bg-muted p-4 text-sm">{status}</p>}
    <form action={`/${entity}`} method="get" role="search" className="my-8 flex max-w-lg items-end gap-3"><div className="flex-1 space-y-2"><label htmlFor={`${entity}-search`} className="text-sm font-semibold">Buscar por {entity === "suppliers" ? "nome fantasia" : "nome"}</label><Input id={`${entity}-search`} name="q" defaultValue={query} placeholder={config.fields[0].label} /></div><Button variant="outline" type="submit">Buscar</Button>{query && <Link href={`/${entity}`} className="py-3 text-sm underline">Limpar</Link>}</form>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{entity === "collaborators" || entity === "academics" ? <div className="grid gap-4 bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">{records.length === 0 ? <p className="col-span-full py-12 text-center text-muted-foreground">Nenhum registro encontrado.</p> : records.map((record) => <article key={record.id} className="relative rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{config.singular}</p><h2 className="mt-2 break-words text-lg font-bold">{record.name}</h2></div>{permissions.canManage && <Button asChild size="sm" className="shrink-0 bg-amber-300 text-amber-950 hover:bg-amber-400"><Link href={`/${entity}/${record.id}/edit`} aria-label={`Editar ${record.name}`}>Editar</Link></Button>}</div><dl className="mt-5 space-y-3 text-sm">{config.fields.filter((field) => field.name !== "name").map((field) => <div key={field.name}><dt className="text-xs text-muted-foreground">{field.label}</dt><dd className="mt-1 break-words font-medium">{record[field.name] || "Não informado"}</dd></div>)}</dl>{permissions.canDelete && <div className="mt-5 flex justify-end border-t border-border pt-3"><DeleteRecord id={record.id} name={record.name ?? config.singular} deleteAction={deleteAction} /></div>}</article>)}</div> : <><Table><caption className="sr-only">{config.title}, página {page} de {pages}</caption><TableHeader><TableRow>{config.fields.map((field) => <TableHead key={field.name} scope="col">{field.label.toUpperCase()}</TableHead>)}<TableHead scope="col" className="text-right">AÇÕES</TableHead></TableRow></TableHeader><TableBody>
      {records.length === 0 ? <TableRow><TableCell colSpan={config.fields.length + 1} className="py-16 text-center text-muted-foreground">{query ? "Nenhum registro encontrado para esta busca." : "Nenhum registro cadastrado."}</TableCell></TableRow> : records.map((record) => <TableRow key={record.id}>
        {config.fields.map((field) => <TableCell key={field.name} className="max-w-md break-words">{record[field.name] || <span className="text-muted-foreground">—</span>}</TableCell>)}
        <TableCell><div className="flex justify-end gap-2">{permissions.canManage && <Button asChild variant="outline" size="sm"><Link href={`/${entity}/${record.id}/edit`} aria-label={`Editar ${record[config.nameColumn]}`}>Editar</Link></Button>}{permissions.canDelete && <DeleteRecord id={record.id} name={record[config.nameColumn] ?? config.singular} deleteAction={deleteAction} />}{!permissions.canManage && <span className="text-xs text-muted-foreground">Somente leitura</span>}</div></TableCell>
      </TableRow>)}
    </TableBody></Table></>}<div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4"><p className="text-xs text-muted-foreground">{count === 0 ? "0 registros" : `${from + 1}–${Math.min(from + records.length, count)} de ${count} registros`}</p><nav aria-label={`Paginação de ${config.title.toLowerCase()}`} className="flex items-center gap-3">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={catalogListUrl(entity, page - 1, query)} rel="prev">Anterior</Link></Button> : <Button variant="outline" size="sm" disabled>Anterior</Button>}<span className="text-xs">Página {page} de {pages}</span>{page < pages ? <Button asChild variant="outline" size="sm"><Link href={catalogListUrl(entity, page + 1, query)} rel="next">Próxima</Link></Button> : <Button variant="outline" size="sm" disabled>Próxima</Button>}</nav></div></div>
  </>;
}

export async function CatalogNewPage({ entity, saveAction }: { entity: CatalogEntity; saveAction: CatalogSaveAction }) {
  if (!catalogPermissions(await requireProfile()).canManage) return <Denied entity={entity} />;
  const config = catalogs[entity];
  return <><Link href={`/${entity}`} className="text-sm text-muted-foreground underline underline-offset-4">← {config.title}</Link><h1 className="display-heading mt-6 text-4xl">{config.newTitle}</h1><p className="mt-3 text-sm text-muted-foreground">Preencha os dados do cadastro. Os campos opcionais podem ficar em branco.</p><CatalogForm entity={entity} saveAction={saveAction} /></>;
}

export async function CatalogEditPage({ entity, params, updateAction }: { entity: CatalogEntity; params: CatalogEditParams; updateAction: (id: unknown, values: unknown) => Promise<CatalogResult> }) {
  if (!catalogPermissions(await requireProfile()).canManage) return <Denied entity={entity} />;
  const id = catalogIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const client = await createClient();
  const config = catalogs[entity];
  const columns = ["id", ...config.fields.map((field) => field.name)].join(",");
  const { data, error } = await client.from(entity).select(columns).eq("id", id.data).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o cadastro.");
  if (!data) notFound();
  return <><Link href={`/${entity}`} className="text-sm text-muted-foreground underline underline-offset-4">← {config.title}</Link><h1 className="display-heading mt-6 text-4xl">{config.editTitle}</h1><p className="mt-3 text-sm text-muted-foreground">Atualize os dados sem alterar os vínculos existentes.</p><CatalogForm entity={entity} record={data as unknown as CatalogRecord} saveAction={updateAction.bind(null, id.data)} /></>;
}
