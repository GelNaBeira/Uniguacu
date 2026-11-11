import { z } from "zod";

const relation = z.union([z.literal(""), z.string().uuid("Selecione uma opção válida.")]);
const price = z.string().trim().refine((value) => !value || /^\d{1,10}([.,]\d{1,2})?$/.test(value), "Informe um preço não negativo com até duas casas decimais.");
const fields = {
  name: z.string().trim().min(1, "Informe o nome do produto."),
  price, bar_code: z.string().trim(), note_id: z.string().trim(), description: z.string().trim(),
  has_barcode: z.boolean(), category_id: relation, sector_id: relation, supplier_id: relation,
};
export const productEditSchema = z.object(fields).strict();
export const quantitySchema = z.number().int("Informe uma quantidade inteira.").min(0, "A quantidade não pode ser negativa.").max(2147483647, "Quantidade acima do limite permitido.");
export const productCreateSchema = productEditSchema.extend({ qtd: quantitySchema }).strict();
export const productIdSchema = z.string().uuid("Identificador de produto inválido.");
export type ProductEditValues = z.infer<typeof productEditSchema>;
export type ProductCreateValues = z.infer<typeof productCreateSchema>;
export type ProductRecord = {
  id: string; name: string; qtd: number; price: number | null; bar_code: string | null;
  note_id: string | null; description: string | null; has_barcode: boolean | null;
  category_id: string | null; sector_id: string | null; supplier_id: string | null; image_path: string | null;
};
export const PRODUCT_COLUMNS = "id,name,qtd,price,bar_code,note_id,description,has_barcode,category_id,sector_id,supplier_id,image_path";
export type ProductResult = { success: true; id: string; warning?: string } | { success: false; message: string };
export function productPayload(values: ProductEditValues | ProductCreateValues) {
  return {
    name: values.name, price: values.price ? values.price.replace(",", ".") : null,
    bar_code: values.bar_code || null, note_id: values.note_id || null, description: values.description || null,
    has_barcode: values.has_barcode, category_id: values.category_id || null,
    sector_id: values.sector_id || null, supplier_id: values.supplier_id || null,
    ...("qtd" in values ? { qtd: values.qtd } : {}),
  };
}
export function productError(code?: string) {
  if (code === "23503") return "Há vínculos com este produto ou uma opção selecionada não está mais disponível. Atualize os dados e tente novamente.";
  if (code === "42501") return "Você não tem permissão para realizar esta operação.";
  if (code === "23514" || code === "22003") return "Confira os valores informados para o produto.";
  if (code === "23505") return "Já existe um registro com estes dados.";
  return "Não foi possível concluir a operação. Tente novamente.";
}