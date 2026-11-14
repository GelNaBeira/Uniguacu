import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadLoans } from "@/lib/lending/queries";
import { kindLabels, statusLabels } from "@/lib/lending/schema";
import type { LoanKindFilter } from "@/lib/lending/pagination";
import type { ReportDocument, ReportInput, ReportTable } from "./schema";

export async function loadReport(input: ReportInput): Promise<ReportDocument> {
  const general = input.scope === "general";
  const filters = input.scope === "operational" ? input.filters : null;
  // Cliente da sessão: mantém RLS e nunca utiliza service_role.
  const loans = await loadLoans(1, filters?.status ?? "ALL", (filters?.kind ?? "all") as LoanKindFilter, filters?.details, true);
  const tables: ReportTable[] = [{ name: "Empréstimos", columns: ["ID", "Item", "Tipo", "Destinatário", "Vínculo", "Saída (UTC / legado)", "Devolução UTC", "Status", "Quantidade", "KM saída", "KM retorno", "Responsável ID"],
    rows: loans.rows.map((r) => [r.id, r.itemName, r.no_return ? "Consumível" : kindLabels[r.kind], r.recipientName,
      r.recipientType === "academic" ? "Acadêmico" : r.recipientType === "collaborator" ? "Colaborador" : "Não informado",
      r.out_at ?? `${r.out_date} (legado)`, r.returned_at ?? "", statusLabels[r.status as keyof typeof statusLabels] ?? r.status ?? "Não informado", r.quantity ?? "", r.km_out ?? "", r.km_in ?? "", r.created_by ?? ""]),
  }];
  if (general) {
    const client = await createClient();
    const table: ReportTable = { name: "Entradas de estoque", columns: ["ID", "Registrado UTC", "Data da entrada", "Produto", "Produto ID", "Quantidade", "Estoque anterior", "Observação", "Responsável ID"], rows: [] };
    // Paginação explícita evita truncamento no limite padrão do PostgREST.
    for (let from = 0; ; from += 100) {
      const { data, error } = await client.from("operations").select("id,created_at,user_id,details").eq("operation_type", "PRODUCT_STOCK_ENTRY")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + 99);
      if (error || !data) throw new Error("Falha ao consultar entradas.");
      for (const row of data) {
        const details = row.details as { name?: string; quantity?: number; previous_quantity?: number; request?: { date?: string; product_id?: string; note?: string } } | null;
        table.rows.push([row.id, row.created_at ?? "", details?.request?.date ?? "", details?.name ?? "Não informado", details?.request?.product_id ?? "", details?.quantity ?? "", details?.previous_quantity ?? "", details?.request?.note ?? "", row.user_id ?? ""]);
      }
      if (table.rows.length > 10000) throw new Error("Limite de entradas excedido.");
      if (data.length < 100) break;
    }
    tables.push(table);
  }
  return { title: general ? "Relatório Geral — Almoxarifado" : "Relatório Operacional — Empréstimos", generatedAt: new Date().toISOString(), tables,
    summary: filters ? `Tipo: ${filters.kind} · Status: ${filters.status} · Saída de ${filters.details.start || "sem limite inicial"} até ${filters.details.end || "sem limite final"} · Vínculo: ${filters.details.recipientType || "todos"} · Nome: ${filters.details.recipient || "todos"}. Todas as páginas; visibilidade conforme seu acesso.` : "Histórico completo de empréstimos (inclui devoluções e consumos) e entradas de estoque auditadas. Sem filtros.",
  };
}