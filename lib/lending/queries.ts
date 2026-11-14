import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mergeLoanPage, PAGE_SIZE, selectedStatuses, type LoanKindFilter } from "./pagination";
import type { LoanRow } from "./schema";
import { escapeLike, type LoanDetails } from "./filters";

const sources = [
  { kind: "product", table: "lendies", relation: "products", extra: "quantity,no_return" },
  { kind: "key", table: "key_lends", relation: "keys", extra: "" },
  { kind: "car", table: "car_key_lends", relation: "car_keys", extra: "km_out" },
] as const;
export async function loadLoans(page: number, status: string, kind: LoanKindFilter, details?: LoanDetails, exportAll = false) {
  const client = await createClient();
  const relations = `collaborator:collaborators${details?.recipientType === "collaborator" ? "!inner" : ""}(name),academic:academics${details?.recipientType === "academic" ? "!inner" : ""}(name)`;
  function filtered(source: typeof sources[number], columns: string, head = false) {
    let request = client.from(source.table).select(columns, { count: "exact", head });
    if (status !== "ALL") request = request.in("status", selectedStatuses(status));
    if (source.kind === "product" && kind !== "all") request = kind === "consumable" ? request.eq("no_return", true) : request.or("no_return.eq.false,no_return.is.null");
    if (details?.start) request = request.gte("out_date", details.start);
    if (details?.end) request = request.lte("out_date", details.end);
    if (details?.recipientType) {
      request = request.not(details.recipientType === "academic" ? "academic_id" : "collaborator_id", "is", null);
      if (details.recipient) request = request.ilike(`${details.recipientType}.name`, `%${escapeLike(details.recipient)}%`);
    }
    return request;
  }
  const selected = sources.filter((s) => kind === "all" || s.kind === kind || (kind === "consumable" && s.kind === "product"));
  const statuses = selectedStatuses(status);
  if (status !== "ALL" && statuses.length === 0) return { rows: [] as LoanRow[], count: 0, page: 1, pages: 1 };
  const counts = await Promise.all(selected.map(async (source) => {
    const { count, error } = await filtered(source, `id,${relations}`, true);
    if (error || count === null) throw new Error("Não foi possível consultar os empréstimos.");
    return count;
  }));
  const count = counts.reduce((sum, n) => sum + n, 0);
  if (exportAll && count > 10000) throw new Error("O relatório excede 10.000 empréstimos. Reduza o período ou os filtros.");
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  // Sem view SECURITY DEFINER ou mudança no banco. Para uma página global N, basta
  // o prefixo N*PAGE_SIZE de cada fonte, lido em lotes abaixo do limite da API.
  const groups = await Promise.all(selected.map(async (source, index) => {
    const rows: LoanRow[] = [];
    const limit = exportAll ? counts[index] : Math.min(counts[index], currentPage * PAGE_SIZE);
    for (let from = 0; from < limit; from += 100) {
      // Relações preservam a resolução existente: collaborator:collaborators(name), academic:academics(name).
      const columns = `id,out_date,out_at,returned_at,status,created_by,request_id,collaborator_id,academic_id,${source.extra ? `${source.extra},` : ""}${source.kind === "car" ? "km_in," : ""}item:${source.relation}(name),${relations}`;
      const { data, error } = await filtered(source, columns)
        .order("out_date", { ascending: false }).order("id", { ascending: false }).range(from, Math.min(from + 99, limit - 1));
      if (error || !data) throw new Error("Não foi possível consultar os empréstimos.");
      type Raw = Omit<LoanRow, "kind" | "itemName" | "recipientName" | "recipientType"> & { item: { name: string } | null; collaborator: { name: string } | null; academic: { name: string } | null; academic_id: string | null; collaborator_id: string | null };
      rows.push(...(data as unknown as Raw[]).map((r): LoanRow => ({
        id: r.id, kind: source.kind, itemName: r.item?.name ?? "Item indisponível",
        recipientName: (r.academic_id ? r.academic?.name : r.collaborator?.name) ?? "Destinatário não disponível",
        recipientType: r.academic_id ? "academic" : r.collaborator_id ? "collaborator" : null, out_date: r.out_date,
        out_at: r.out_at, status: r.status, created_by: r.created_by, request_id: r.request_id,
        quantity: r.quantity ?? null, km_out: r.km_out ?? null, no_return: r.no_return ?? null,
        returned_at: r.returned_at ?? null, km_in: r.km_in ?? null,
      })));
    }
    return rows;
  }));
  const rows = groups.flat();
  return { rows: exportAll ? rows.sort((a, b) => b.out_date.localeCompare(a.out_date) || b.id.localeCompare(a.id) || a.kind.localeCompare(b.kind)) : mergeLoanPage(rows, currentPage), count, page: currentPage, pages };
}