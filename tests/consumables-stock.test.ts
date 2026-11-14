import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { productCreateSchema, productPayload } from "../lib/products/schema.ts";
import { stockEntrySchema } from "../lib/products/stock.ts";
import { parseLendingQuery, selectedStatuses, lendingUrl } from "../lib/lending/pagination.ts";
import { isReturnable, type LoanRow } from "../lib/lending/schema.ts";
import { catalogs, academicSchema } from "../lib/catalogs/schema.ts";

const id = "50000000-0000-4000-8000-000000000001";
const entry = { productId: id, requestId: id, quantity: 3, date: "2026-11-13", note: "NF 123" };
test("entrada: quantidade positiva, UUIDs, data real, nota limitada e allowlist", () => {
  assert.equal(stockEntrySchema.safeParse(entry).success, true);
  for (const patch of [{ quantity: 0 }, { quantity: -1 }, { quantity: 0.5 }, { quantity: NaN }, { quantity: 2147483648 }, { productId: "x" }, { requestId: "" }, { date: "2026-02-30" }, { date: "" }, { note: "x".repeat(2001) }, { actor: id }]) assert.equal(stockEntrySchema.safeParse({ ...entry, ...patch }).success, false);
  assert.equal(stockEntrySchema.parse({ ...entry, note: " NF 123 " }).note, "NF 123");
});
test("produtos: consumível é booleano e vai ao payload sem permitir alteração de estoque na edição", () => {
  const values = { name: "Papel", price: "", bar_code: "", note_id: "", description: "", has_barcode: false, category_id: "", sector_id: "", supplier_id: "", qtd: 10 };
  for (const is_consumable of [true, false]) assert.equal(productPayload(productCreateSchema.parse({ ...values, is_consumable })).is_consumable, is_consumable);
  assert.equal(productCreateSchema.safeParse({ ...values, is_consumable: "true" }).success, false);
});
test("Home: abas e filtros combináveis preservam paginação e seleção vazia", () => {
  assert.deepEqual(parseLendingQuery({ kind: "consumable" }), { page: 1, kind: "consumable", status: "SEM_DEVOLUCAO", invalid: false });
  const query = parseLendingQuery({ kind: "key", status: ["EM_ANDAMENTO", "DEVOLVIDO"] });
  assert.equal(query.invalid, false);
  assert.deepEqual(selectedStatuses(query.status), ["EM_ANDAMENTO", "DEVOLVIDO"]);
  const url = new URL(lendingUrl(2, query.status, query.kind), "http://localhost");
  assert.equal(url.searchParams.get("status"), "EM_ANDAMENTO,DEVOLVIDO");
  assert.equal(parseLendingQuery({ filtered: "1" }).status, "NONE");
  assert.deepEqual(selectedStatuses("NONE"), []);
  for (const status of ["", "ACTIVE,DEVOLVIDO", "ATRASADO,invalid"]) assert.equal(parseLendingQuery({ status }).invalid, true);
});
test("consumo nunca oferece devolução mesmo com todas as permissões", () => {
  const loan = { kind: "product", no_return: true, status: "SEM_DEVOLUCAO", created_by: id, out_at: "2026-11-13T12:00:00Z", request_id: id } as LoanRow;
  assert.equal(isReturnable(loan, id, { canReturn: true, canViewAll: true }), false);
  assert.equal(isReturnable({ ...loan, status: "EM_ANDAMENTO" }, id, { canReturn: true, canViewAll: true }), false);
});
test("acadêmicos: telefone opcional disponível no cadastro e nos cards", () => {
  assert.ok(catalogs.academics.fields.some((field) => field.name === "phone"));
  assert.equal(academicSchema.parse({ name: "Ana", ra: "123", course: "Direito", phone: " 45999999999 " }).phone, "45999999999");
});
const sql = readFileSync(new URL("../supabase/migrations/0011_consumables_stock.sql", import.meta.url), "utf8");
test("migration: consumíveis preservam contrato, destinatários, payload antigo e segurança", () => {
  assert.match(sql, /is_consumable boolean not null default false/);
  assert.match(sql, /no_return is true and status = 'SEM_DEVOLUCAO' and returned_at is null and returned_quantity = 0/);
  assert.match(sql, /moment,resource.is_consumable,case when resource.is_consumable then 'SEM_DEVOLUCAO'/);
  assert.match(sql, /private.lending_retry\(p_request_id,'PRODUCT_LEND',payload\)/);
  assert.match(sql, /private.lending_actor\('can_lend'\)/);
  assert.match(sql, /p_academic_id uuid default null/);
  assert.match(sql, /update public.products set qtd = qtd - p_quantity/);
  assert.ok(!sql.includes("update public.lendies"));
});
test("migration: entrada tem permissão, mutex, retry auditado, lock do produto e nenhum grant de qtd", () => {
  assert.match(sql, /private.has_permission\('can_manage_products'\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /previous.details -> 'request' is distinct from payload/);
  assert.match(sql, /return previous.id/);
  assert.match(sql, /where id = p_product_id for update/);
  assert.match(sql, /update public.products set qtd = qtd \+ p_quantity/);
  assert.match(sql, /'PRODUCT_STOCK_ENTRY',actor,p_request_id/);
  assert.equal((sql.match(/security definer set search_path = ''/g) ?? []).length, 2);
  assert.ok(!/grant update\s*\(qtd\)/.test(sql));
  assert.match(sql, /revoke all on function public.add_product_stock[^;]+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public.add_product_stock[^;]+to authenticated/);
});