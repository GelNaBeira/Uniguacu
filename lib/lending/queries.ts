import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mergeLoanPage, PAGE_SIZE, selectedStatuses, type LoanKindFilter } from "./pagination";
import type { LoanRow } from "./schema";

const sources = [
  { kind: "product", table: "lendies", relation: "products", extra: "quantity,no_return" },
  { kind: "key", table: "key_lends", relation: "keys", extra: "" },
  { kind: "car", table: "car_key_lends", relation: "car_keys", extra: "km_out" },
] as const;
export async function loadLoans(page: number, status: string, kind: LoanKindFilter) {
  const client = await createClient();
  const selected = sources.filter((s) => kind === "all" || s.kind === kind || (kind === "consumable" && s.kind === "product"));
  const statuses = selectedStatuses(status);
  if (statuses.length === 0) return { rows: [] as LoanRow[], count: 0, page: 1, pages: 1 };
  const counts = await Promise.all(selected.map(async (source) => {
    let request = client.from(source.table).select("id", { count: "exact", head: true }).in("status", statuses);
    if (source.kind === "product" && kind !== "all") request = kind === "consumable" ? request.eq("no_return", true) : request.or("no_return.eq.false,no_return.is.null");
    const { count, error } = await request;
    if (error || count === null) throw new Error("Não foi possível consultar os empréstimos.");
    return count;
  }));
  const count = counts.reduce((sum, n) => sum + n, 0);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  // Sem view SECURITY DEFINER ou mudança no banco. Para uma página global N, basta
  // o prefixo N*PAGE_SIZE de cada fonte, lido em lotes abaixo do limite da API.
  const groups = await Promise.all(selected.map(async (source, index) => {
    const rows: LoanRow[] = [];
    const limit = Math.min(counts[index], currentPage * PAGE_SIZE);
    for (let from = 0; from < limit; from += 100) {
      const columns = `id,out_date,out_at,status,created_by,request_id,collaborator_id,academic_id,${source.extra ? `${source.extra},` : ""}item:${source.relation}(name),collaborator:collaborators(name),academic:academics(name)`;
      let request = client.from(source.table).select(columns).in("status", statuses);
      if (source.kind === "product" && kind !== "all") request = kind === "consumable" ? request.eq("no_return", true) : request.or("no_return.eq.false,no_return.is.null");
      const { data, error } = await request
        .order("out_date", { ascending: false }).order("id", { ascending: false }).range(from, Math.min(from + 99, limit - 1));
      if (error || !data) throw new Error("Não foi possível consultar os empréstimos.");
      type Raw = Omit<LoanRow, "kind" | "itemName" | "recipientName" | "recipientType"> & { item: { name: string } | null; collaborator: { name: string } | null; academic: { name: string } | null; academic_id: string | null; collaborator_id: string | null };
      rows.push(...(data as unknown as Raw[]).map((r): LoanRow => ({
        id: r.id, kind: source.kind, itemName: r.item?.name ?? "Item indisponível",
        recipientName: (r.academic_id ? r.academic?.name : r.collaborator?.name) ?? "Destinatário não disponível",
        recipientType: r.academic_id ? "academic" : r.collaborator_id ? "collaborator" : null, out_date: r.out_date,
        out_at: r.out_at, status: r.status, created_by: r.created_by, request_id: r.request_id,
        quantity: r.quantity ?? null, km_out: r.km_out ?? null, no_return: r.no_return ?? null,
      })));
    }
    return rows;
  }));
  return { rows: mergeLoanPage(groups.flat(), currentPage), count, page: currentPage, pages };
}