import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lendingPermissions, type PermissionProfile } from "../lib/auth/permissions.ts";
import { executeLendingCommand, type LendingRepository } from "../lib/lending/service.ts";
import { lendSchema, returnSchema, isReturnable, lendingError, selectedLendError, type LoanRow } from "../lib/lending/schema.ts";
import { parseLendingQuery, lendingUrl, mergeLoanPage } from "../lib/lending/pagination.ts";

const id = "50000000-0000-4000-8000-000000000001";
const collaboratorId = "50000000-0000-4000-8000-000000000002";
const requestId = "50000000-0000-4000-8000-000000000003";
const admin: PermissionProfile = { role: "ADMIN", is_active: true, limited_access: null };
const user: PermissionProfile = { role: "USER", is_active: true, limited_access: { version: 1, can_read_inventory: true, can_lend: true, can_return: true } };
const product = { kind: "product", resourceId: id, collaboratorId, requestId, quantity: 2 };
function fixture(data: unknown = id, code?: string) {
  const calls: { name: string; args: Record<string, string | number | null> }[] = [];
  const repository: LendingRepository = { rpc: async (name, args) => { calls.push({ name, args }); return { data, error: code ? { code } : null }; } };
  return { calls, repository };
}
test("empréstimos: ADMIN ativo e flags operacionais independentes", () => {
  assert.deepEqual(lendingPermissions(admin), { canRead: true, canLend: true, canReturn: true, canViewAll: true });
  assert.deepEqual(lendingPermissions(user), { canRead: true, canLend: true, canReturn: true, canViewAll: false });
  assert.equal(lendingPermissions({ ...admin, is_active: false }).canLend, false);
  for (const access of [{ version: 2, can_lend: true }, { version: 1, can_lend: "true", can_read_inventory: true }, { version: 1, can_lend: true }]) {
    assert.equal(lendingPermissions({ ...user, limited_access: access }).canLend, false);
  }
});
test("empréstimos: colaborador/UUID obrigatórios, inteiros e campos extras rejeitados", () => {
  assert.equal(lendSchema.safeParse(product).success, true);
  for (const values of [{ ...product, collaboratorId: null }, { ...product, requestId: "" }, { ...product, quantity: 0 }, { ...product, quantity: 1.5 }, { ...product, quantity: 2147483648 }, { ...product, created_by: id }, { ...product, status: "DEVOLVIDO" }]) assert.equal(lendSchema.safeParse(values).success, false);
  assert.equal(lendSchema.safeParse({ kind: "key", resourceId: id, collaboratorId, requestId, quantity: 1 }).success, false);
  assert.equal(lendSchema.safeParse({ kind: "car", resourceId: id, collaboratorId, requestId }).success, false);
  assert.equal(lendSchema.safeParse({ kind: "car", resourceId: id, collaboratorId, requestId, kmOut: 0 }).success, true);
  assert.equal(returnSchema.safeParse({ kind: "car", loanId: id, kmIn: -1 }).success, false);
  assert.equal(returnSchema.safeParse({ kind: "product", loanId: id, quantity: 1 }).success, false);
});
test("formulário: estoque máximo e odômetro cadastrado validados sem substituir RPC", () => {
  const parsed = lendSchema.parse(product);
  assert.equal(selectedLendError(parsed, { id, name: "Produto", qtd: 2 }), null);
  assert.match(selectedLendError(parsed, { id, name: "Produto", qtd: 1 }) ?? "", /estoque/);
  assert.match(selectedLendError(parsed, null) ?? "", /Selecione/);
  const car = lendSchema.parse({ kind: "car", resourceId: id, collaboratorId, requestId, kmOut: 100 });
  assert.equal(selectedLendError(car, { id, name: "Carro", mileage: 100 }), null);
  assert.match(selectedLendError(car, { id, name: "Carro", mileage: 101 }) ?? "", /odômetro/);
});
for (const kind of ["product", "key", "car"] as const) {
  test(`${kind}: RPC de saída com argumentos exatos e identidade não encaminhada`, async () => {
    const f = fixture();
    const values = { kind, resourceId: id, collaboratorId, requestId, ...(kind === "product" ? { quantity: 2 } : kind === "car" ? { kmOut: 100 } : {}) };
    assert.equal((await executeLendingCommand("lend", user, f.repository, values)).success, true);
    assert.deepEqual(f.calls, [{ name: `lend_${kind}`, args: { p_collaborator_id: collaboratorId, p_academic_id: null, p_request_id: requestId, ...(kind === "product" ? { p_product_id: id, p_quantity: 2 } : kind === "key" ? { p_key_id: id } : { p_car_id: id, p_km_out: 100 }) } }]);
  });
  test(`${kind}: acadêmico aceito e exclusividade validada antes da RPC`, async () => {
    const values = { kind, resourceId: id, collaboratorId: null, academicId: collaboratorId, requestId, ...(kind === "product" ? { quantity: 2 } : kind === "car" ? { kmOut: 100 } : {}) };
    const f = fixture();
    assert.deepEqual(await executeLendingCommand("lend", user, f.repository, values), { success: true, id });
    assert.deepEqual(f.calls[0], { name: `lend_${kind}`, args: { p_collaborator_id: null, p_academic_id: collaboratorId, p_request_id: requestId, ...(kind === "product" ? { p_product_id: id, p_quantity: 2 } : kind === "key" ? { p_key_id: id } : { p_car_id: id, p_km_out: 100 }) } });
    assert.equal(lendSchema.safeParse({ ...values, collaboratorId: undefined }).success, true);
    for (const patch of [{ collaboratorId }, { academicId: null }, { academicId: undefined }, { academicId: "inválido" }]) {
      const invalid = fixture();
      assert.equal((await executeLendingCommand("lend", user, invalid.repository, { ...values, ...patch })).success, false);
      assert.equal(invalid.calls.length, 0);
    }
    await executeLendingCommand("lend", user, f.repository, values);
    assert.deepEqual(f.calls[0], f.calls[1]);
  });
  test(`${kind}: RPC de retorno integral e odômetro somente para carro`, async () => {
    const f = fixture();
    const result = await executeLendingCommand("return", admin, f.repository, { kind, loanId: id, ...(kind === "car" ? { kmIn: 150 } : {}) });
    assert.deepEqual(result, { success: true, id });
    assert.deepEqual(f.calls, [{ name: `return_${kind}`, args: { p_lend_id: id, ...(kind === "car" ? { p_km_in: 150 } : {}) } }]);
  });
}
test("empréstimos: permissão revogada e input inválido nunca chamam RPC", async () => {
  const f = fixture();
  const revoked = { ...user, limited_access: { version: 1, can_read_inventory: true, can_return: true } };
  assert.equal((await executeLendingCommand("lend", revoked, f.repository, product)).success, false);
  assert.equal((await executeLendingCommand("return", { ...user, is_active: false }, f.repository, { kind: "key", loanId: id })).success, false);
  assert.equal((await executeLendingCommand("lend", admin, f.repository, { ...product, kind: "usuarios" })).success, false);
  assert.equal(f.calls.length, 0);
});
test("empréstimos: UUID idempotente é encaminhado sem regenerar no servidor", async () => {
  const f = fixture();
  await executeLendingCommand("lend", user, f.repository, product);
  await executeLendingCommand("lend", user, f.repository, product);
  assert.deepEqual(f.calls[0], f.calls[1]);
});
test("empréstimos: falha RPC, resultado ausente e rede nunca viram sucesso", async () => {
  for (const code of ["42501", "23514", "23503", "22023", "P0002", "22003"]) {
    const f = fixture(null, code);
    assert.deepEqual(await executeLendingCommand("lend", user, f.repository, product), { success: false, ...lendingError(code) });
    assert.equal(lendingError(code).uncertain, false);
  }
  for (const data of [null, {}, "not-a-uuid"]) {
    assert.deepEqual(await executeLendingCommand("lend", user, fixture(data).repository, product), { success: false, ...lendingError() });
  }
  assert.equal(lendingError("57014").uncertain, true);
  const repository: LendingRepository = { rpc: async () => { throw new Error("segredo interno"); } };
  assert.deepEqual(await executeLendingCommand("lend", user, repository, product), { success: false, ...lendingError() });
});
const row: LoanRow = { id, kind: "product", itemName: "Produto", recipientName: "Pessoa", recipientType: "academic", out_date: "2026-11-13", out_at: "2026-11-13T12:00:00Z", status: "EM_ANDAMENTO", created_by: id, request_id: requestId, quantity: 2, km_out: null, no_return: false };
test("devolução: escopo por autor/visão ampliada; concluído e legado bloqueados", () => {
  assert.equal(isReturnable(row, id, lendingPermissions(user)), true);
  assert.equal(isReturnable(row, collaboratorId, lendingPermissions(user)), false);
  assert.equal(isReturnable(row, collaboratorId, lendingPermissions(admin)), true);
  for (const patch of [{ status: "DEVOLVIDO" }, { request_id: null }, { out_at: null }, { no_return: true }]) assert.equal(isReturnable({ ...row, ...patch }, id, lendingPermissions(admin)), false);
});
test("Home: filtros seguros e URLs preservam tipo/status", () => {
  assert.deepEqual(parseLendingQuery({}), { page: 1, status: "ACTIVE", kind: "product", invalid: false });
  for (const input of [{ status: "INVALID" }, { kind: ["car"] }, { status: ["ATRASADO", "INVALID"] }]) assert.equal(parseLendingQuery(input).invalid, true);
  assert.equal(parseLendingQuery({ page: "99999999999999999999999" }).page, 1);
  const url = new URL(lendingUrl(2, "DEVOLVIDO", "car"), "http://localhost");
  assert.equal(url.searchParams.get("status"), "DEVOLVIDO"); assert.equal(url.searchParams.get("kind"), "car");
});
test("Home: merge global de três fontes tem paginação sem duplicação e desempate", () => {
  const rows = Array.from({ length: 36 }, (_, n): LoanRow => ({ ...row, id: String(n).padStart(4, "0"), kind: ["product", "key", "car"][n % 3] as LoanRow["kind"] }));
  const pages = [1, 2, 3, 4].flatMap((page) => mergeLoanPage(rows, page));
  assert.equal(new Set(pages.map((r) => r.id)).size, 36);
  assert.equal(pages[0].id, "0035"); assert.equal(pages[35].id, "0000");
  const prefix = rows.filter((r) => ["0035", "0034", "0033"].includes(r.id));
  assert.deepEqual(mergeLoanPage(prefix, 1).map((r) => r.id), ["0035", "0034", "0033"]);
});
test("Home: Server Actions usam sessão e RPC, sem DML direto ou service role", () => {
  const actions = readFileSync(new URL("../app/(app)/home/actions.ts", import.meta.url), "utf8");
  assert.ok(actions.startsWith('"use server"'));
  assert.ok(actions.includes("requireProfile()")); assert.ok(actions.includes("client.rpc(name, args)"));
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|service_role/.test(actions));
  const form = readFileSync(new URL("../components/lending/new-loan.tsx", import.meta.url), "utf8");
  assert.ok(form.includes('import { v4 as uuidv4 } from "uuid"')); assert.ok(form.includes("inFlight.current"));
  assert.equal(form.match(/requestId\.current = uuidv4\(\)/g)?.length, 2);
  assert.ok(!form.includes("crypto.randomUUID"));
  assert.ok(form.includes("intent.current = parsed.data")); assert.ok(form.includes("if (!uncertain && !result.uncertain)"));
  assert.ok(form.includes("setUncertain(uncertain || result.uncertain)"));
  assert.ok(form.includes('key={recipientType} kind={recipientType}'));
  assert.ok(form.includes('setRecipient(null); setError("")'));
  assert.ok(actions.includes('academic: { table: "academics", columns: "id,name" }'));
  const queries = readFileSync(new URL("../lib/lending/queries.ts", import.meta.url), "utf8");
  assert.ok(queries.includes('academic:academics(name)'));
  assert.ok(queries.includes('r.academic_id ? r.academic?.name : r.collaborator?.name'));
  const home = readFileSync(new URL("../app/(app)/home/page.tsx", import.meta.url), "utf8");
  assert.ok(home.includes("{row.recipientName}"));
  assert.ok(home.includes('"Acadêmico" : "Colaborador"'));
});
