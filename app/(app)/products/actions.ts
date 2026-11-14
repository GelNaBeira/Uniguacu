"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { productPermissions } from "@/lib/auth/permissions";
import { productRepository } from "@/lib/products/repository";
import { executeProductCommand } from "@/lib/products/service";
import { attachProductPhoto, cleanupProductPhotos, validateProductPhoto } from "@/lib/products/images";
import { productError, type ProductResult } from "@/lib/products/schema";
import { stockEntrySchema } from "@/lib/products/stock";
import { createClient } from "@/lib/supabase/server";
import { lendingError, type LendingResult } from "@/lib/lending/schema";

export async function addStock(input: unknown): Promise<LendingResult> {
  const profile = await requireProfile();
  if (!productPermissions(profile).canManage) return { success: false, message: productError("42501"), uncertain: false };
  const parsed = stockEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Confira os dados da entrada.", uncertain: false };
  const values = parsed.data;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("add_product_stock", { p_product_id: values.productId, p_quantity: values.quantity, p_date: values.date, p_note: values.note, p_request_id: values.requestId });
    if (error) return { success: false, ...lendingError(error.code) };
    if (typeof data !== "string") return { success: false, ...lendingError() };
    revalidatePath("/products"); revalidatePath("/home"); revalidatePath(`/products/${values.productId}/edit`);
    return { success: true, id: data };
  } catch { return { success: false, ...lendingError() }; }
}

async function saveProduct(values: unknown, photoForm: FormData, id?: unknown): Promise<ProductResult> {
  const profile = await requireProfile();
  const permissions = productPermissions(profile);
  if (!permissions.canManage) return { success: false, message: productError("42501") };
  let photo: Awaited<ReturnType<typeof validateProductPhoto>>;
  try { photo = await validateProductPhoto(photoForm); }
  catch { return { success: false, message: "Não foi possível ler a foto selecionada." }; }
  if (photo.error) return { success: false, message: photo.error };
  const result = await executeProductCommand(profile, await productRepository(), id === undefined ? { type: "create", values } : { type: "update", id, values });
  if (!result.success) return result;
  let warning: string | undefined;
  if (photo.file) {
    try { warning = await attachProductPhoto(result.id, photo.file, permissions.canDelete); }
    catch { warning = "Produto salvo, mas houve falha no envio da foto. Verifique a edição antes de tentar novamente; um arquivo pode precisar de limpeza."; }
  }
  revalidatePath("/products"); revalidatePath(`/products/${result.id}/edit`);
  return { ...result, warning };
}
export async function createProduct(values: unknown, photo: FormData) { return saveProduct(values, photo); }
export async function updateProduct(id: unknown, values: unknown, photo: FormData) { return saveProduct(values, photo, id); }
export async function deleteProduct(id: unknown): Promise<ProductResult> {
  const profile = await requireProfile();
  const result = await executeProductCommand(profile, await productRepository(), { type: "delete", id });
  if (result.success) {
    try { result.warning = await cleanupProductPhotos(result.id); }
    catch { result.warning = "Produto excluído. A limpeza das fotos ficou pendente; informe a administração."; }
    revalidatePath("/products");
  }
  return result;
}