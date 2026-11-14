import "server-only";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/server";
import { imageContentError, imageExtension, imageMetadataError } from "./image-validation";
import { productIdSchema } from "./schema";

export async function validateProductPhoto(form: FormData) {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { file: null, error: null };
  const error = imageMetadataError(file.size, file.type);
  if (error) return { file: null, error };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { file: { bytes, type: file.type }, error: imageContentError(bytes, file.type) };
}

export async function attachProductPhoto(id: string, photo: { bytes: Uint8Array; type: string }, canDelete: boolean): Promise<string | undefined> {
  const client = await createClient();
  const { data: product, error: readError } = await client.from("products").select("image_path").eq("id", id).maybeSingle();
  if (readError || !product) return "Produto salvo, mas a foto não pôde ser vinculada. Abra a edição para tentar novamente.";
  const path = `${id}/${uuidv4()}.${imageExtension(photo.type)}`;
  const { error: uploadError } = await client.storage.from("product-images").upload(path, photo.bytes, { contentType: photo.type, upsert: false, cacheControl: "300" });
  if (uploadError) return "Produto salvo, mas o envio da foto falhou. Abra a edição para tentar novamente.";
  let request = client.from("products").update({ image_path: path }).eq("id", id);
  // Evita que edições concorrentes de foto sobrescrevam silenciosamente uma à outra.
  request = product.image_path === null ? request.is("image_path", null) : request.eq("image_path", product.image_path);
  const { data, error } = await request.select("id").maybeSingle();
  if (error || !data) {
    if (canDelete) {
      const { error: cleanupError } = await client.storage.from("product-images").remove([path]);
      if (!cleanupError) return "Produto salvo, mas a vinculação da foto falhou ou foi alterada em outra sessão. Atualize a página e tente novamente.";
    }
    return "Produto salvo, mas a foto não foi vinculada. Um arquivo pode ter ficado pendente de limpeza pela administração.";
  }
  if (product.image_path) {
    if (!canDelete) return "Produto e nova foto salvos. A foto anterior ficou pendente de limpeza pela administração, pois seu perfil não permite excluir arquivos.";
    const { error: cleanupError } = await client.storage.from("product-images").remove([product.image_path]);
    if (cleanupError) return "Produto e nova foto salvos. A limpeza da foto anterior está pendente; informe a administração.";
  }
}

export async function signedProductImage(id: string, path: string | null): Promise<string | null> {
  if (!path || !productIdSchema.safeParse(id).success || !path.startsWith(`${id}/`)) return null;
  const client = await createClient();
  const { data, error } = await client.storage.from("product-images").createSignedUrl(path, 300);
  return error ? null : data.signedUrl;
}

export async function cleanupProductPhotos(id: string): Promise<string | undefined> {
  const client = await createClient();
  // Após excluir a linha: remove também substituições antigas e uploads órfãos.
  // Sempre busca a primeira página, pois a remoção muda os offsets.
  for (;;) {
    const { data, error } = await client.storage.from("product-images").list(id, { limit: 100, offset: 0 });
    if (error || !data) return "Produto excluído. A limpeza das fotos ficou pendente; informe a administração.";
    if (!data.length) return;
    const paths = data.map((object) => `${id}/${object.name}`);
    const { data: removed, error: removeError } = await client.storage.from("product-images").remove(paths);
    if (removeError || !removed || removed.length !== paths.length) return "Produto excluído. Algumas fotos ficaram pendentes de limpeza pela administração.";
  }
}