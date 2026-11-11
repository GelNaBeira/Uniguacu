import { catalogPermissions, type PermissionProfile } from "../auth/permissions.ts";
import { catalogEntitySchema, catalogError, catalogIdSchema, catalogPayload, catalogs, type CatalogResult } from "./schema.ts";

type DbResult = { id: string | null; failed?: boolean; errorCode?: string };
export type CatalogRepository = {
  create: (values: Record<string, string | null>) => Promise<DbResult>;
  update: (id: string, values: Record<string, string | null>) => Promise<DbResult>;
  remove: (id: string) => Promise<DbResult>;
};
export type CatalogCommand = { type: "create"; values: unknown } | { type: "update"; id: unknown; values: unknown } | { type: "delete"; id: unknown };

export async function executeCatalogCommand(entity: unknown, profile: PermissionProfile, repository: CatalogRepository, command: CatalogCommand): Promise<CatalogResult> {
  const parsedEntity = catalogEntitySchema.safeParse(entity);
  if (!parsedEntity.success) return { success: false, message: "Cadastro inválido." };
  const key = parsedEntity.data;
  const permissions = catalogPermissions(profile);
  if (!(command.type === "delete" ? permissions.canDelete : permissions.canManage)) return { success: false, message: catalogError(key, "42501") };
  try {
    const id = command.type === "create" ? undefined : catalogIdSchema.safeParse(command.id);
    if (id && !id.success) return { success: false, message: "Identificador inválido." };
    let result: DbResult;
    if (command.type === "delete") {
      if (!id?.success) return { success: false, message: "Identificador inválido." };
      result = await repository.remove(id.data);
    } else {
      const parsed = catalogs[key].schema.safeParse(command.values);
      if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
      const payload = catalogPayload(key, parsed.data);
      if (command.type === "create") result = await repository.create(payload);
      else {
        if (!id?.success) return { success: false, message: "Identificador inválido." };
        result = await repository.update(id.data, payload);
      }
    }
    if (result.failed || result.errorCode) return { success: false, message: catalogError(key, result.errorCode) };
    if (!result.id) return { success: false, message: "Registro não encontrado ou acesso não permitido. Atualize a listagem." };
    return { success: true };
  } catch { return { success: false, message: catalogError(key) }; }
}