import { productPermissions, type PermissionProfile } from "../auth/permissions.ts";
import { productCreateSchema, productEditSchema, productIdSchema, productPayload, productError, type ProductResult } from "./schema.ts";
type DbResult = { id: string | null; errorCode?: string; failed?: boolean };
export type ProductRepository = {
  create: (values: ReturnType<typeof productPayload>) => Promise<DbResult>;
  update: (id: string, values: ReturnType<typeof productPayload>) => Promise<DbResult>;
  remove: (id: string) => Promise<DbResult>;
};
export type ProductCommand = { type: "create"; values: unknown } | { type: "update"; id: unknown; values: unknown } | { type: "delete"; id: unknown };
export async function executeProductCommand(profile: PermissionProfile, repository: ProductRepository, command: ProductCommand): Promise<ProductResult> {
  const permissions = productPermissions(profile);
  if (!(command.type === "delete" ? permissions.canDelete : permissions.canManage)) return { success: false, message: productError("42501") };
  try {
    const id = command.type === "create" ? undefined : productIdSchema.safeParse(command.id);
    if (id && !id.success) return { success: false, message: "Identificador de produto inválido." };
    let result: DbResult;
    if (command.type === "delete") {
      if (!id?.success) return { success: false, message: "Identificador de produto inválido." };
      result = await repository.remove(id.data);
    } else {
      const parsed = (command.type === "create" ? productCreateSchema : productEditSchema).safeParse(command.values);
      if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
      const payload = productPayload(parsed.data);
      if (command.type === "create") result = await repository.create(payload);
      else {
        if (!id?.success) return { success: false, message: "Identificador de produto inválido." };
        result = await repository.update(id.data, payload);
      }
    }
    if (result.failed || result.errorCode) return { success: false, message: productError(result.errorCode) };
    if (!result.id) return { success: false, message: "Produto não encontrado ou acesso não permitido. Atualize a listagem." };
    return { success: true, id: result.id };
  } catch { return { success: false, message: productError() }; }
}