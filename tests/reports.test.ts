import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { reportPermissions, type PermissionProfile } from "../lib/auth/permissions.ts";
import { loanDetailsSchema, parseLoanDetails, escapeLike } from "../lib/lending/filters.ts";
import { lendingUrl } from "../lib/lending/pagination.ts";
import { executeReport } from "../lib/reports/service.ts";
import { renderReport } from "../lib/reports/render.ts";
import { reportSchema, type ReportDocument } from "../lib/reports/schema.ts";

const admin: PermissionProfile = { role: "ADMIN", is_active: true, limited_access: null };
const user: PermissionProfile = { role: "USER", is_active: true, limited_access: { version: 1, can_read_inventory: true, can_view_reports: true } };
const details = { start: "2026-01-01", end: "2026-12-31", recipientType: "academic", recipient: "Maria" };
const operational = { scope: "operational", format: "pdf", filters: { status: "DEVOLVIDO", kind: "car", details } };
const document: ReportDocument = { title: "Relatório Operacional", summary: "Filtros aplicados", generatedAt: "2026-11-13T12:00:00.000Z", tables: [
  { name: "Empréstimos", columns: ["Item", "Quantidade"], rows: [["=HYPERLINK(\"https://invalid\")", 4], ["Produto com acentuação", 2]] },
  { name: "Entradas de estoque", columns: ["Produto", "Quantidade"], rows: [] },
] };

test("relatórios: matriz de autorização independente da visibilidade ampliada", () => {
  assert.deepEqual(reportPermissions(admin), { operational: true, general: true });
  assert.deepEqual(reportPermissions(user), { operational: true, general: false });
  for (const profile of [{ ...admin, is_active: false }, { ...user, is_active: false }, { ...user, role: "OTHER" },
    { ...user, limited_access: { version: 1, can_view_reports: true } },
    { ...user, limited_access: { version: 1, can_read_inventory: true, can_view_all_lends: true } },
    { ...user, limited_access: { version: 1, can_read_inventory: true, can_view_reports: "true" } }]) {
    assert.deepEqual(reportPermissions(profile), { operational: false, general: false });
  }
});
test("relatórios: USER não consulta nem renderiza relatório geral por chamada direta", async () => {
  let calls = 0;
  const deps = { load: async () => { calls++; return document; }, render: renderReport };
  for (const format of ["pdf", "xlsx"]) {
    assert.equal((await executeReport(user, { scope: "general", format }, deps)).success, false);
    assert.equal((await executeReport({ ...admin, is_active: false }, { scope: "general", format }, deps)).success, false);
    assert.equal((await executeReport({ ...user, limited_access: null }, { ...operational, format }, deps)).success, false);
  }
  assert.equal(calls, 0);
});
test("relatórios: filtros validados e encaminhados sem página ou identidade controlável", async () => {
  const result = await executeReport(user, operational, { load: async (input) => { assert.deepEqual(input, operational); return document; }, render: renderReport });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.filename, "relatorio-operacional-2026-11-13.pdf");
  for (const input of [{ ...operational, format: "csv" }, { ...operational, userId: "other" },
    { ...operational, filters: { ...operational.filters, status: "ALL" } },
    { ...operational, filters: { ...operational.filters, kind: "usuarios" } },
    { scope: "general", format: "pdf", filters: operational.filters }]) assert.equal(reportSchema.safeParse(input).success, false);
});
test("filtros: calendário real, intervalo, vínculo, arrays e escapes literais", () => {
  assert.equal(loanDetailsSchema.safeParse(details).success, true);
  for (const patch of [{ start: "2026-02-30" }, { start: "2027-01-01" }, { recipientType: "" }, { recipient: "a".repeat(101) }, { recipientType: "other" }]) assert.equal(loanDetailsSchema.safeParse({ ...details, ...patch }).success, false);
  assert.equal(parseLoanDetails({ start: ["2026-01-01"] }).success, false);
  assert.equal(escapeLike("100%_\\"), "100\\%\\_\\\\");
  const url = new URL(lendingUrl(3, "DEVOLVIDO", "car", details), "http://localhost");
  assert.equal(url.searchParams.get("recipient"), "Maria");
  assert.equal(url.searchParams.get("start"), details.start);
});
test("relatórios: falhas e arquivos excessivos não retornam exportação parcial", async () => {
  assert.equal((await executeReport(admin, operational, { load: async () => { throw new Error("private SQL"); }, render: renderReport })).success, false);
  assert.equal((await executeReport(admin, operational, { load: async () => document, render: async () => { throw new Error("failure"); } })).success, false);
  assert.equal((await executeReport(admin, operational, { load: async () => document, render: async () => ({ base64: "a".repeat(24 * 1024 * 1024 + 1), mime: "application/pdf" }) })).success, false);
});
test("Excel: arquivo reaberto com seções, valores numéricos e texto sem fórmulas", async () => {
  const file = await renderReport(document, "xlsx");
  assert.match(file.mime, /spreadsheetml/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(Buffer.from(file.base64, "base64")).buffer);
  assert.equal(workbook.worksheets.length, 3);
  const sheet = workbook.getWorksheet("Empréstimos")!;
  assert.equal(sheet.getCell("A2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("A2").value, document.tables[0].rows[0][0]);
  assert.equal(sheet.getCell("B2").value, 4);
  assert.equal(sheet.getCell("A3").value, "Produto com acentuação");
  assert.equal(workbook.getWorksheet("Entradas de estoque")!.rowCount, 1);
});
test("PDF: binário válido, múltiplas páginas e tabelas vazias", async () => {
  const file = await renderReport({ ...document, tables: [{ ...document.tables[0], rows: Array.from({ length: 150 }, (_, i) => [`Produto ${i}`, i]) }, document.tables[1]] }, "pdf");
  const pdf = Buffer.from(file.base64, "base64").toString("latin1");
  assert.equal(file.mime, "application/pdf");
  assert.ok(pdf.startsWith("%PDF-"));
  assert.ok(pdf.includes("%%EOF"));
  assert.ok((pdf.match(/\/Type \/Page\b/g) ?? []).length > 2);
});
test("integração estrutural: sessão/RLS, paginação e UI usam filtros comuns", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const action = read("../app/(app)/reports/actions.ts");
  assert.ok(action.includes("await requireProfile()"));
  assert.ok(action.includes("executeReport(profile, input"));
  const queries = read("../lib/reports/queries.ts");
  assert.ok(!queries.includes("supabase/admin"));
  assert.ok(queries.includes('eq("operation_type", "PRODUCT_STOCK_ENTRY")'));
  assert.ok(queries.includes(".range(from, from + 99)"));
  const loans = read("../lib/lending/queries.ts");
  for (const filter of ['gte("out_date", details.start)', 'lte("out_date", details.end)', 'escapeLike(details.recipient)', 'exportAll ? counts[index]']) assert.ok(loans.includes(filter));
  const home = read("../app/(app)/home/page.tsx");
  assert.ok(home.includes("reportPermissions(profile).operational"));
  assert.ok(home.includes("query.kind, details)"));
});