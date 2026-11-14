import { z } from "zod";
import { permissionFlags } from "../auth/permissions.ts";

export const permissionLabels: Record<typeof permissionFlags[number], string> = {
  can_read_inventory: "Consultar estoque", can_manage_catalogs: "Gerenciar cadastros",
  can_manage_products: "Gerenciar produtos e estoque", can_manage_keys: "Gerenciar chaves",
  can_manage_cars: "Gerenciar carros", can_lend: "Registrar empréstimos e saídas",
  can_return: "Registrar devoluções", can_delete: "Excluir cadastros sem vínculos",
  can_view_reports: "Consultar relatórios operacionais", can_view_all_lends: "Ver empréstimos de todos os operadores",
};
const accessFields = Object.fromEntries(permissionFlags.map((flag) => [flag, z.boolean()])) as Record<typeof permissionFlags[number], z.ZodBoolean>;
export const accessSchema = z.object({ version: z.literal(1), ...accessFields }).strict();
export function accessFromForm(form: FormData) {
  return { version: 1, ...Object.fromEntries(permissionFlags.map((flag) => [flag, form.get(flag) === "on"])) };
}
export const profileSchema = z.object({ name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(120) });
export const userAccessSchema = z.object({ id: z.uuid(), role: z.enum(["ADMIN", "USER"]), limited_access: accessSchema });
export const newUserSchema = profileSchema.extend({
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  password: z.string().min(12, "A senha inicial deve ter pelo menos 12 caracteres.").max(128),
  role: z.enum(["ADMIN", "USER"]), limited_access: accessSchema,
});
export type UserRow = { id: string; name: string; email: string; role: "ADMIN" | "USER"; is_active: boolean; limited_access: unknown };
export type UserResult = { success: boolean; message: string };
export function accountError(code?: string) {
  if (code === "23514") return "Mantenha pelo menos um administrador ativo. Revise também os dados e permissões.";
  if (code === "42501") return "Seu acesso não permite esta operação. Atualize a página.";
  if (code === "PGRST202" || code === "42883") return "A migração de Perfil e Administração ainda não foi aplicada ao banco.";
  return "Não foi possível concluir a operação. Atualize a página antes de tentar novamente.";
}