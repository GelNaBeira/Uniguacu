"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { productPermissions } from "@/lib/auth/permissions";
import { productRepository } from "@/lib/products/repository";
import { executeProductCommand } from "@/lib/products/service";
import { attachProductPhoto, cleanupProductPhotos, validateProductPhoto } from "@/lib/products/images";
import { productError, type ProductResult } from "@/lib/products/schema";

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