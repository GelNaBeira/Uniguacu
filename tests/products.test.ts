import test from "node:test";
import assert from "node:assert/strict";
import { productPermissions } from "../lib/auth/permissions.ts";
import { productCreateSchema, productEditSchema, productPayload, productError } from "../lib/products/schema.ts";
import { executeProductCommand, type ProductRepository } from "../lib/products/service.ts";
import { IMAGE_MAX_SIZE, imageMetadataError, imageContentError, detectImageType } from "../lib/products/image-validation.ts";
import { parseProductQuery, productListUrl, pageRange, escapeLike } from "../lib/products/pagination.ts";

const id = "40000000-0000-4000-8000-000000000001";
const values = { name: "Produto de teste", price: "", bar_code: "", note_id: "", description: "", has_barcode: false, category_id: "", sector_id: "", supplier_id: "" };
const admin = { role: "ADMIN", is_active: true, limited_access: null };
const user = { role: "USER", is_active: true, limited_access: { version: 1, can_read_inventory: true, can_manage_products: true, can_delete: false } };
function repository(result: { id: string | null; errorCode?: string; failed?: boolean } = { id }) {
  const calls: { operation: string; payload?: unknown }[] = [];
  const repo: ProductRepository = {
    create: async (payload) => { calls.push({ operation: "create", payload }); return result; },
    update: async (_id, payload) => { calls.push({ operation: "update", payload }); return result; },
    remove: async () => { calls.push({ operation: "delete" }); return result; },
  };
  return { repo, calls };
}

test("produto: cadastro aceita quantidade inicial zero e inteiro positivo", () => {
  for (const qtd of [0, 5, 2147483647]) assert.equal(productCreateSchema.safeParse({ ...values, qtd }).success, true);
});
test("produto: quantidade inicial rejeita negativo, fracionado, NaN, texto e overflow", () => {
  for (const qtd of [-1, 1.5, NaN, "1", 2147483648, undefined]) assert.equal(productCreateSchema.safeParse({ ...values, qtd }).success, false);
});
test("produto: edição rejeita qtd e campos técnicos injetados", () => {
  for (const extra of [{ qtd: 9 }, { id }, { created_at: "2026-11-11" }, { image_path: `${id}/outro.png` }]) assert.equal(productEditSchema.safeParse({ ...values, ...extra }).success, false);
});
test("produto: nome obrigatório e trim", () => {
  assert.equal(productEditSchema.safeParse({ ...values, name: "   " }).success, false);
  assert.equal(productEditSchema.parse({ ...values, name: "  Monitor  " }).name, "Monitor");
});
test("produto: preço aceita decimal ponto/vírgula e limite numeric(12,2)", () => {
  for (const price of ["", "0", "12,34", "12.34", "9999999999.99"]) assert.equal(productEditSchema.safeParse({ ...values, price }).success, true);
});
test("produto: preço rejeita negativos, expoente, precisão excedida e texto", () => {
  for (const price of ["-1", "1.234", "1e3", "10000000000", "NaN", "12,3a"]) assert.equal(productEditSchema.safeParse({ ...values, price }).success, false);
});
test("produto: relações aceitam vazio ou UUID, nunca identificador malformado", () => {
  for (const field of ["category_id", "sector_id", "supplier_id"]) {
    assert.equal(productEditSchema.safeParse({ ...values, [field]: id }).success, true);
    assert.equal(productEditSchema.safeParse({ ...values, [field]: "inválido" }).success, false);
  }
});
test("produto: opcionais persistem NULL, booleano false e quantidade inicial preservados", () => {
  const payload = productPayload(productCreateSchema.parse({ ...values, qtd: 3 }));
  assert.equal(payload.qtd, 3); assert.equal(payload.price, null); assert.equal(payload.bar_code, null);
  assert.equal(payload.category_id, null); assert.equal(payload.supplier_id, null); assert.equal(payload.description, null); assert.equal(payload.has_barcode, false);
});
test("produto: payload de edição não contém qtd e preço decimal é convertido sem float", () => {
  const payload = productPayload(productEditSchema.parse({ ...values, price: "25,50", bar_code: "001234", has_barcode: true }));
  assert.equal("qtd" in payload, false); assert.equal(payload.price, "25.50"); assert.equal(payload.bar_code, "001234"); assert.equal(payload.has_barcode, true);
});
test("produto: ADMIN ativo possui todas as permissões; inativo não", () => {
  assert.deepEqual(productPermissions(admin), { canRead: true, canManage: true, canDelete: true });
  assert.deepEqual(productPermissions({ ...admin, is_active: false }), { canRead: false, canManage: false, canDelete: false });
});
test("produto: USER depende de leitura + manage_products; manage_catalogs não substitui", () => {
  for (const limited_access of [{ version: 1, can_manage_products: true }, { version: 1, can_read_inventory: true, can_manage_catalogs: true }, { version: 2, can_read_inventory: true, can_manage_products: true }, { version: 1, can_read_inventory: true, can_manage_products: "true" }]) assert.equal(productPermissions({ ...user, limited_access }).canManage, false);
  assert.equal(productPermissions(user).canManage, true); assert.equal(productPermissions(user).canDelete, false);
});
test("produto: criação autorizada encaminha quantidade inicial", async () => {
  const { repo, calls } = repository();
  assert.equal((await executeProductCommand(user, repo, { type: "create", values: { ...values, qtd: 4 } })).success, true);
  assert.equal((calls[0].payload as { qtd: number }).qtd, 4);
});
test("produto: edição autorizada não encaminha qtd", async () => {
  const { repo, calls } = repository();
  assert.equal((await executeProductCommand(user, repo, { type: "update", id, values })).success, true);
  assert.equal("qtd" in (calls[0].payload as object), false);
});
test("produto: tentativa de atualizar estoque pelo comando é rejeitada antes do banco", async () => {
  const { repo, calls } = repository();
  assert.equal((await executeProductCommand(admin, repo, { type: "update", id, values: { ...values, qtd: 99 } })).success, false);
  assert.equal(calls.length, 0);
});
test("produto: exclusão USER exige flag adicional e permissão atual revogada bloqueia escrita", async () => {
  const { repo, calls } = repository();
  assert.equal((await executeProductCommand(user, repo, { type: "delete", id })).success, false);
  assert.equal((await executeProductCommand({ ...user, is_active: false }, repo, { type: "create", values: { ...values, qtd: 0 } })).success, false);
  assert.equal(calls.length, 0);
  assert.equal((await executeProductCommand({ ...user, limited_access: { ...user.limited_access, can_delete: true } }, repo, { type: "delete", id })).success, true);
});
test("produto: ids inválidos e campos de criação extras não alcançam repository", async () => {
  const { repo, calls } = repository();
  assert.equal((await executeProductCommand(admin, repo, { type: "delete", id: "x" })).success, false);
  assert.equal((await executeProductCommand(admin, repo, { type: "create", values: { ...values, qtd: 0, image_path: "x" } })).success, false);
  assert.equal(calls.length, 0);
});
test("produto: FK e permissão do banco viram erros legíveis", async () => {
  for (const errorCode of ["23503", "42501", "23514"]) {
    const { repo } = repository({ id: null, failed: true, errorCode });
    assert.deepEqual(await executeProductCommand(admin, repo, { type: "delete", id }), { success: false, message: productError(errorCode) });
  }
});
test("produto: linha invisível/inexistente nunca resulta em sucesso", async () => {
  const { repo } = repository({ id: null });
  assert.equal((await executeProductCommand(admin, repo, { type: "update", id, values })).success, false);
});
test("produto: falha inesperada não expõe detalhes internos", async () => {
  const { repo } = repository(); repo.create = async () => { throw new Error("detalhe interno"); };
  assert.deepEqual(await executeProductCommand(admin, repo, { type: "create", values: { ...values, qtd: 0 } }), { success: false, message: productError() });
});
test("foto: aceita metadados permitidos até exatamente 3MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(imageMetadataError(IMAGE_MAX_SIZE, type), null);
  assert.ok(imageMetadataError(IMAGE_MAX_SIZE + 1, "image/png")); assert.ok(imageMetadataError(0, "image/png"));
});
test("foto: rejeita SVG, executável e MIME vazio", () => {
  for (const type of ["image/svg+xml", "application/octet-stream", "text/html", ""]) assert.ok(imageMetadataError(100, type));
});
test("foto: valida assinatura PNG/JPEG/WebP sem confiar em extensão", () => {
  const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]); png.set([73,72,68,82], 12);
  const jpg = new Uint8Array(12); jpg.set([255,216,255]);
  const webp = new Uint8Array(16); webp.set(new TextEncoder().encode("RIFF")); webp.set(new TextEncoder().encode("WEBPVP8 "), 8);
  for (const [bytes, type] of [[png, "image/png"], [jpg, "image/jpeg"], [webp, "image/webp"]] as const) { assert.equal(detectImageType(bytes), type); assert.equal(imageContentError(bytes, type), null); }
  assert.ok(imageContentError(png, "image/jpeg"));
  assert.ok(imageContentError(new TextEncoder().encode("<svg>alert(1)</svg>"), "image/png"));
  assert.equal(detectImageType(new Uint8Array([255,216,255])), null);
});
test("produtos: query normaliza página, trim e rejeita filtros UUID inválidos", () => {
  assert.deepEqual(parseProductQuery({ q: "  monitor  ", page: "2", category: id }), { query: "monitor", page: 2, category: id, sector: "", invalid: false });
  assert.equal(parseProductQuery({ page: "-1", sector: "x" }).invalid, true);
  assert.equal(parseProductQuery({ page: "-1" }).page, 1);
  assert.deepEqual(pageRange(2), { from: 10, to: 19 });
});
test("produtos: paginação preserva filtros e busca literal", () => {
  const url = new URL(productListUrl(3, "cabo & adaptador", id, id), "http://localhost");
  assert.equal(url.searchParams.get("q"), "cabo & adaptador"); assert.equal(url.searchParams.get("category"), id); assert.equal(url.searchParams.get("sector"), id); assert.equal(url.searchParams.get("page"), "3");
  assert.equal(escapeLike("100%_"), "100\\%\\_");
});