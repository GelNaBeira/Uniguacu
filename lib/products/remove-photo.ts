import type { SupabaseClient } from "@supabase/supabase-js";
import { productIdSchema } from "./schema.ts";

// O caminho vem do formulário apenas como versão esperada, nunca como alvo livre.
export async function removeProductPhoto(client: SupabaseClient, id: string, expectedPath: string): Promise<string | undefined> {
  if (!productIdSchema.safeParse(id).success || !expectedPath.startsWith(`${id}/`) ||
      !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(expectedPath)) {
    return "Produto salvo, mas a referência da foto é inválida. Atualize a página.";
  }
  const { data: product, error: readError } = await client.from("products").select("image_path").eq("id", id).maybeSingle();
  if (readError || !product) return "Produto salvo, mas não foi possível consultar a foto. Atualize a página e tente novamente.";
  if (product.image_path !== expectedPath) return "Produto salvo, mas a foto foi alterada em outra sessão. Atualize a página antes de removê-la.";
  // Desvincula primeiro: a policy impede excluir arquivos ainda referenciados.
  const { data, error } = await client.from("products").update({ image_path: null }).eq("id", id).eq("image_path", expectedPath).select("id").maybeSingle();
  if (error || !data) return "Produto salvo, mas a foto não foi removida ou foi alterada em outra sessão. Atualize a página e tente novamente.";
  try {
    const { data: removed, error: removeError } = await client.storage.from("product-images").remove([expectedPath]);
    if (!removeError && removed?.some((object) => object.name === expectedPath)) return;
  } catch { /* Banco e Storage não compartilham transação; informa a limpeza pendente. */ }
  return "Produto salvo sem foto. A exclusão do arquivo no Storage ficou pendente; informe a administração.";
}