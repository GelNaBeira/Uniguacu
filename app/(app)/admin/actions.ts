"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessFromForm, accountError, newUserSchema, userAccessSchema, type UserResult } from "@/lib/users/schema";

export async function createUser(_previous: UserResult, form: FormData): Promise<UserResult> {
  const actor = await requireAdmin();
  const parsed = newUserSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password"), role: form.get("role"), limited_access: accessFromForm(form) });
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const client = await createClient();
  // Gate SQL com sessão/RLS antes de acessar a API privilegiada. O trigger revalida o ator.
  const { error: gateError } = await client.rpc("admin_user_gate");
  if (gateError) return { success: false, message: accountError(gateError.code) };
  const admin = createAdminClient();
  if (!admin) return { success: false, message: "Configure SUPABASE_SERVICE_ROLE_KEY exclusivamente no ambiente do servidor para criar usuários." };
  const { name, email, password, role, limited_access } = parsed.data;
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { name }, app_metadata: { provisioning: { actor_id: actor.id, role, limited_access } },
  });
  // Não retornar objetos do Auth, senha ou mensagens internas do provedor.
  if (error) return { success: false, message: error.code === "email_exists" || error.code === "email_address_exists"
    ? "Já existe uma conta com este e-mail." : "Não foi possível confirmar a criação. Consulte a lista antes de repetir; confira o e-mail e a política de senhas." };
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { success: true, message: "Usuário criado. Entregue a senha inicial por um canal seguro e oriente sua alteração." };
}

export async function updateUserAccess(_previous: UserResult, form: FormData): Promise<UserResult> {
  await requireAdmin();
  const parsed = userAccessSchema.safeParse({ id: form.get("id"), role: form.get("role"), limited_access: accessFromForm(form) });
  if (!parsed.success) return { success: false, message: "Confira o usuário, papel e permissões." };
  const client = await createClient();
  const { error } = await client.rpc("admin_update_user_access", { p_id: parsed.data.id, p_role: parsed.data.role, p_access: parsed.data.limited_access });
  if (error) return { success: false, message: accountError(error.code) };
  revalidatePath("/", "layout");
  return { success: true, message: "Papel e permissões atualizados." };
}