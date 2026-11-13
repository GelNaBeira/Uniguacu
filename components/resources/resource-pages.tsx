import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { resourcePermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { resources, resourceIdSchema, type ResourceEntity, type ResourceRecord, type ResourceResult } from "@/lib/resources/schema";
import { resourceListUrl, parseResourceQuery, PAGE_SIZE, pageRange, escapeLike } from "@/lib/resources/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteRecord } from "@/components/catalogs/delete-record";
import { ResourceForm } from "./resource-form";

export type ResourceSearchParams = Promise<Record<string, string | string[] | undefined>>;
export type ResourceEditParams = Promise<{ id: string }>;
type SaveAction = (values: unknown) => Promise<ResourceResult>;
function Denied() { return <section><h1 className="display-heading text-4xl">Acesso não permitido</h1><p role="alert" className="my-6">Você não tem permissão para esta operação.</p><Link href="/home" className="underline">Voltar ao início</Link></section>; }

export async function ResourceListPage({ entity, searchParams, deleteAction }: {
  entity: ResourceEntity; searchParams: ResourceSearchParams; deleteAction: (id: unknown) => Promise<ResourceResult>;
}) {
  const permissions = resourcePermissions(await requireProfile(), entity);
  if (!permissions.canRead) return <Denied />;
  const config = resources[entity];
  const params = await searchParams;
  const { page, query, status, invalid } = parseResourceQuery(params);
  if (invalid) return <section><h1 className="display-heading text-4xl">Filtro inválido</h1><p role="alert" className="my-6">Selecione um status válido.</p><Link href={`/${entity}`} className="underline">Limpar filtros</Link></section>;
  const client = await createClient();
  let countRequest = client.from(config.table).select("id", { count: "exact", head: true });
  if (query) countRequest = countRequest.ilike("name", `%${escapeLike(query)}%`);
  if (status) countRequest = countRequest.eq("status", status);
  const { count, error: countError } = await countRequest;
  if (countError || count === null) throw new Error("Não foi possível consultar os cadastros.");
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > pages) redirect(resourceListUrl(entity, pages, query, status));
  const { from, to } = pageRange(page);
  let request = client.from(config.table).select(config.columns).order("name").order("id").range(from, to);
  if (query) request = request.ilike("name", `%${escapeLike(query)}%`);
  if (status) request = request.eq("status", status);
  const { data, error } = await request;
  if (error || !data) throw new Error("Não foi possível consultar os cadastros.");
  const records = data as unknown as ResourceRecord[];
  const message = params.result === "created" ? "Cadastro criado com sucesso." : params.result === "updated" ? "Cadastro atualizado com sucesso." : null;
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">CADASTROS / RECURSOS</p><h1 className="display-heading mt-3 text-5xl">{config.title}</h1><p className="mt-3 text-sm text-muted-foreground">Consulte e mantenha os cadastros de {config.title.toLowerCase()}.</p></div>{permissions.canManage && <Button asChild><Link href={`/${entity}/new`}>+ {config.newTitle}</Link></Button>}</div>
    {message && <p role="status" className="mt-6 rounded-md border border-border bg-muted p-4 text-sm">{message}</p>}
    <form action={`/${entity}`} method="get" role="search" className="my-8 flex flex-wrap items-end gap-4"><div className="min-w-48 flex-1 space-y-2"><label htmlFor="resource-search" className="text-sm font-semibold">Buscar por nome</label><Input id="resource-search" name="q" defaultValue={query} placeholder="Nome" /></div><div className="min-w-48 space-y-2"><label htmlFor="resource-filter" className="text-sm font-semibold">Status</label><Select id="resource-filter" name="status" defaultValue={status}><option value="">Todos</option><option value="DISPONIVEL">Disponível</option><option value="INDISPONIVEL">Indisponível</option></Select></div><Button type="submit" variant="outline">Filtrar</Button>{(query || status) && <Link href={`/${entity}`} className="py-3 text-sm underline">Limpar</Link>}</form>
    <div className="overflow-hidden rounded-xl border border-border bg-card"><Table><caption className="sr-only">{config.title}, página {page} de {pages}</caption><TableHeader><TableRow><TableHead scope="col">NOME</TableHead><TableHead scope="col">STATUS</TableHead>{entity === "cars" && <TableHead scope="col">QUILOMETRAGEM</TableHead>}<TableHead scope="col" className="text-right">AÇÕES</TableHead></TableRow></TableHeader><TableBody>{records.length === 0 ? <TableRow><TableCell colSpan={entity === "cars" ? 4 : 3} className="py-16 text-center text-muted-foreground">Nenhum cadastro encontrado.</TableCell></TableRow> : records.map((record) => <TableRow key={record.id}><TableCell className="max-w-md break-words font-medium">{record.name}</TableCell><TableCell><span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${record.status === "DISPONIVEL" ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>{record.status === "DISPONIVEL" ? "Disponível" : "Indisponível"}</span></TableCell>{entity === "cars" && <TableCell>{record.mileage == null ? "—" : `${record.mileage.toLocaleString("pt-BR")} km`}</TableCell>}<TableCell><div className="flex justify-end gap-2">{permissions.canManage && <Button asChild variant="outline" size="sm"><Link href={`/${entity}/${record.id}/edit`} aria-label={`Editar ${record.name}`}>Editar</Link></Button>}{permissions.canDelete && <DeleteRecord id={record.id} name={record.name} deleteAction={deleteAction} />}{!permissions.canManage && <span className="text-xs text-muted-foreground">Somente leitura</span>}</div></TableCell></TableRow>)}</TableBody></Table><div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4"><p className="text-xs text-muted-foreground">{count === 0 ? "0 registros" : `${from + 1}–${Math.min(from + records.length, count)} de ${count} registros`}</p><nav aria-label={`Paginação de ${config.title.toLowerCase()}`} className="flex items-center gap-3">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={resourceListUrl(entity, page - 1, query, status)} rel="prev">Anterior</Link></Button> : <Button variant="outline" size="sm" disabled>Anterior</Button>}<span className="text-xs">Página {page} de {pages}</span>{page < pages ? <Button asChild variant="outline" size="sm"><Link href={resourceListUrl(entity, page + 1, query, status)} rel="next">Próxima</Link></Button> : <Button variant="outline" size="sm" disabled>Próxima</Button>}</nav></div></div>
  </>;
}

export async function ResourceNewPage({ entity, saveAction }: { entity: ResourceEntity; saveAction: SaveAction }) {
  const permissions = resourcePermissions(await requireProfile(), entity);
  if (!permissions.canManage) return <Denied />;
  const config = resources[entity];
  return <><Link href={`/${entity}`} className="text-sm underline">← {config.title}</Link><h1 className="display-heading mt-6 text-4xl">{config.newTitle}</h1><p className="mt-3 text-sm text-muted-foreground">O cadastro será criado com status disponível.</p><ResourceForm entity={entity} correctMileage={permissions.canCorrectMileage} saveAction={saveAction} /></>;
}

export async function ResourceEditPage({ entity, params, updateAction }: { entity: ResourceEntity; params: ResourceEditParams; updateAction: (id: unknown, values: unknown) => Promise<ResourceResult> }) {
  const permissions = resourcePermissions(await requireProfile(), entity);
  if (!permissions.canManage) return <Denied />;
  const id = resourceIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const config = resources[entity];
  const client = await createClient();
  const { data, error } = await client.from(config.table).select(config.columns).eq("id", id.data).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o cadastro.");
  if (!data) notFound();
  return <><Link href={`/${entity}`} className="text-sm underline">← {config.title}</Link><h1 className="display-heading mt-6 text-4xl">{config.editTitle}</h1><p className="mt-3 text-sm text-muted-foreground">Atualize os dados sem alterar o status de disponibilidade.</p><ResourceForm entity={entity} record={data as unknown as ResourceRecord} correctMileage={permissions.canCorrectMileage} saveAction={updateAction.bind(null, id.data)} /></>;
}