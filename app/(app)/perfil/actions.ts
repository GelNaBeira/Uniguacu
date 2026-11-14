"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { imageContentError, imageExtension, imageMetadataError } from "@/lib/products/image-validation";
import { accountError, profileSchema, type UserResult } from "@/lib/users/schema";

export async function saveProfile(_previous: UserResult, form: FormData): Promise<UserResult> {
  const profile = await requireProfile();
  const parsed = profileSchema.safeParse({ name: form.get("name") });
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Confira o nome." };
  const client = await createClient();
  let path: string | null = null;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    const metadataError = imageMetadataError(file.size, file.type);
    if (metadataError) return { success: false, message: metadataError };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentError = imageContentError(bytes, file.type);
    if (contentError) return { success: false, message: contentError };
    path = `${profile.id}/${uuidv4()}.${imageExtension(file.type)}`;
    const { error } = await client.storage.from("profile-images").upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) return { success: false, message: "Não foi possível enviar a foto. Confira se a migração de Perfil foi aplicada e tente novamente." };
  }
  const { error } = await client.rpc("update_my_profile", { p_name: parsed.data.name, p_photo: path });
  if (error) {
    if (path) await client.storage.from("profile-images").remove([path]);
    return { success: false, message: accountError(error.code) };
  }
  // Fotos anteriores não são removidas aqui: outra sessão pode estar salvando uma substituição.
  revalidatePath("/", "layout");
  return { success: true, message: "Perfil atualizado." };
}

export async function deactivateAccount(_previous: UserResult, form: FormData): Promise<UserResult> {
  await requireProfile();
  if (form.get("confirmation") !== "on") return { success: false, message: "Confirme que deseja inativar sua conta." };
  const client = await createClient();
  const { error } = await client.rpc("deactivate_my_account");
  if (error) return { success: false, message: accountError(error.code) };
  await client.auth.signOut({ scope: "global" });
  // O perfil inativo bloqueia também sessões antigas, mesmo se a revogação do Auth falhar.
  await client.auth.signOut({ scope: "local" });
  redirect("/login?status=access");
}