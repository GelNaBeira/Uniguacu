import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { lendingPermissions } from "@/lib/auth/permissions";
import { loadLoans } from "@/lib/lending/queries";
import { parseLendingQuery, lendingUrl, selectedStatuses } from "@/lib/lending/pagination";
import { isReturnable, kindLabels, statusLabels } from "@/lib/lending/schema";
import { NewLoan } from "@/components/lending/new-loan";
import { ReturnLoan } from "@/components/lending/return-loan";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  const permissions = lendingPermissions(profile);
  if (!permissions.canRead) return <section><h1 className="display-heading text-4xl">Acesso não permitido</h1><p role="alert" className="mt-5">Você não tem permissão para consultar o inventário e os empréstimos.</p></section>;
  const query = parseLendingQuery(await searchParams);
  if (query.invalid) return <section><h1 className="display-heading text-4xl">Filtro inválido</h1><p role="alert" className="my-5">Selecione um status e um tipo de item válidos.</p><Link href="/home" className="underline">Limpar filtros</Link></section>;
  const result = await loadLoans(query.page, query.status, query.kind);
  if (result.page !== query.page) redirect(lendingUrl(result.page, query.status, query.kind));
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
  return <>
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
      <div><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">ESPAÇO DE TRABALHO / MOVIMENTAÇÕES</p><h1 className="display-heading mt-3 text-4xl sm:text-5xl">Empréstimos</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Produtos, chaves e carros sob responsabilidade de quem usa. Registre a saída e acompanhe o retorno integral.</p></div>
      <div className="flex flex-col items-start gap-3">{permissions.canLend ? <NewLoan initialKind={query.kind === "car" || query.kind === "key" ? query.kind : "product"} /> : <span className="text-sm text-muted-foreground">Registro de saída não autorizado</span>}</div>
    </div>
    <nav aria-label="Tipos de movimentação" className="mt-7 flex gap-1 overflow-x-auto border-b border-border">{[{ kind: "product", label: "Produtos" }, { kind: "consumable", label: "Consumíveis" }, { kind: "car", label: "Carros" }, { kind: "key", label: "Chaves" }].map((tab) => <Link key={tab.kind} href={lendingUrl(1, tab.kind === "consumable" ? "SEM_DEVOLUCAO" : query.kind === "consumable" ? "ACTIVE" : query.status, tab.kind)} aria-current={query.kind === tab.kind ? "page" : undefined} className={`whitespace-nowrap border-b-3 px-6 py-4 text-sm font-semibold ${query.kind === tab.kind ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground hover:bg-muted"}`}>{tab.label}</Link>)}</nav>
    <form method="get" key={`${query.kind}-${query.status}`} className="my-7 flex flex-wrap items-center gap-4">
      <input type="hidden" name="kind" value={query.kind} />
      <input type="hidden" name="filtered" value="1" />
      <fieldset className="flex flex-wrap gap-5"><legend className="sr-only">Status dos empréstimos</legend>{[...([{ value: "EM_ANDAMENTO", label: "Em andamento" }, { value: "ATRASADO", label: "Atrasados" }, { value: "DEVOLVIDO", label: "Devolvidos" }]), ...(query.kind === "consumable" ? [{ value: "SEM_DEVOLUCAO", label: "Consumo registrado" }] : [])].map((filter) => <label key={filter.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="status" value={filter.value} defaultChecked={selectedStatuses(query.status).includes(filter.value as ReturnType<typeof selectedStatuses>[number])} className="h-4 w-4 accent-primary" />{filter.label}</label>)}</fieldset>
      <Button type="submit">Filtrar</Button><Link href="/home" className="py-3 text-sm underline underline-offset-4">Limpar filtros</Link>
    </form>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap justify-between gap-2 border-b border-border px-6 py-4 text-xs text-muted-foreground"><span>{result.count} empréstimo(s) encontrado(s) · {permissions.canViewAll ? "Visão ampliada" : "Seus empréstimos"}</span><span>Datas efetivas em UTC · atraso automático não habilitado</span></div>
      <Table><TableHeader><TableRow><TableHead scope="col">ITEM / TIPO</TableHead><TableHead scope="col">DESTINATÁRIO</TableHead><TableHead scope="col">VÍNCULO</TableHead><TableHead scope="col">SAÍDA (UTC)</TableHead><TableHead scope="col">STATUS</TableHead><TableHead scope="col" className="text-right">AÇÕES</TableHead></TableRow></TableHeader>
        <TableBody>{result.rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-16 text-center"><p className="display-heading text-2xl">Nenhum empréstimo por aqui.</p><p className="mt-3 text-sm text-muted-foreground">Revise os filtros ou registre uma nova saída, se autorizado.</p></TableCell></TableRow> : result.rows.map((row) => <TableRow key={`${row.kind}-${row.id}`}>
          <TableCell className="max-w-xs break-words"><p className="font-semibold">{row.itemName}</p><p className="mt-1 text-xs text-muted-foreground">{kindLabels[row.kind]}{row.kind === "product" ? ` · ${row.quantity} unidade(s)` : row.kind === "car" ? ` · saída ${row.km_out ?? "—"} km` : ""}</p></TableCell>
          <TableCell className="max-w-xs break-words">{row.recipientName}</TableCell>
          <TableCell><span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold">{row.recipientType ? row.recipientType === "academic" ? "Acadêmico" : "Colaborador" : "Não informado"}</span></TableCell>
          <TableCell className="whitespace-nowrap">{row.out_at ? <time dateTime={row.out_at}>{dateFormat.format(new Date(row.out_at))}</time> : <><time dateTime={row.out_date}>{row.out_date.split("-").reverse().join("/")}</time><span className="mt-1 block text-xs text-muted-foreground">Legado · data sem fuso</span></>}</TableCell>
          <TableCell><span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${row.status === "ATRASADO" ? "border-amber-200 bg-amber-50 text-amber-900" : row.status === "DEVOLVIDO" ? "border-border bg-muted text-muted-foreground" : "border-primary/20 bg-primary/5 text-primary"}`}>{statusLabels[row.status as keyof typeof statusLabels] ?? row.status ?? "Não informado"}</span></TableCell>
          <TableCell className="text-right">{isReturnable(row, profile.id, permissions) ? <ReturnLoan loan={row} /> : <span className="text-xs text-muted-foreground">{row.status === "SEM_DEVOLUCAO" ? "Sem devolução" : row.status === "DEVOLVIDO" ? "Concluído" : !row.request_id || !row.out_at || row.no_return === true ? "Legado: reconciliar antes de devolver" : "Somente leitura"}</span>}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <nav aria-label="Paginação dos empréstimos" className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4"><p className="text-xs text-muted-foreground">Página {result.page} de {result.pages} · 10 por página</p><div className="flex gap-3">{result.page > 1 && <Button asChild variant="outline" size="sm"><Link href={lendingUrl(result.page - 1, query.status, query.kind)}>Anterior</Link></Button>}{result.page < result.pages && <Button asChild variant="outline" size="sm"><Link href={lendingUrl(result.page + 1, query.status, query.kind)}>Próxima</Link></Button>}</div></nav>
    </div>
  </>;
}