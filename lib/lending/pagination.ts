import type { LoanRow } from "./schema.ts";

export const PAGE_SIZE = 10;
export const filters = ["ACTIVE", "EM_ANDAMENTO", "ATRASADO", "DEVOLVIDO", "SEM_DEVOLUCAO"] as const;
export type StatusFilter = typeof filters[number];
export type LoanKindFilter = "all" | "consumable" | LoanRow["kind"];
export function selectedStatuses(status: string): StatusFilter[] {
  return status === "ACTIVE" ? ["EM_ANDAMENTO", "ATRASADO"] : status.split(",").filter((value): value is StatusFilter => filters.includes(value as StatusFilter) && value !== "ACTIVE");
}
export function parseLendingQuery(params: Record<string, string | string[] | undefined>) {
  const kind = params.kind ?? "product";
  const rawStatus = params.status ?? (params.filtered === "1" ? "NONE" : kind === "consumable" ? "SEM_DEVOLUCAO" : "ACTIVE");
  const status = Array.isArray(rawStatus) ? rawStatus.join(",") : rawStatus;
  const validStatus = status === "NONE" || status === "ACTIVE" || (status.split(",").length > 0 && status.split(",").every((value) => filters.includes(value as StatusFilter) && value !== "ACTIVE"));
  const rawPage = typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    status: validStatus ? status : "ACTIVE",
    kind: ["all", "product", "consumable", "key", "car"].includes(String(kind)) ? kind as LoanKindFilter : "all" as const,
    invalid: !validStatus || typeof kind !== "string" || !["all", "product", "consumable", "key", "car"].includes(kind),
  };
}
export function lendingUrl(page: number, status: string, kind: string) {
  return `/home?${new URLSearchParams({ page: String(page), status, kind })}`;
}
// Mesma ordenação de cada consulta: data de saída e UUID descendentes; tipo desempata.
export function mergeLoanPage(rows: LoanRow[], page: number) {
  return [...rows].sort((a, b) => b.out_date.localeCompare(a.out_date) || b.id.localeCompare(a.id) || a.kind.localeCompare(b.kind))
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}