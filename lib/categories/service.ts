import { catalogPermissions, type PermissionProfile } from "../auth/permissions.ts";
import { categoryError, categoryIdSchema, categorySchema, type CategoryResult } from "./schema.ts";

type DbResult = { id: string | null; errorCode?: string; failed?: boolean };
export type CategoryRepository = {
  create: (name: string) => Promise<DbResult>;
  update: (id: string, name: string) => Promise<DbResult>;
  remove: (id: string) => Promise<DbResult>;
};
type Command = { type: "create"; values: unknown } | { type: "update"; id: unknown; values: unknown } | { type: "delete"; id: unknown };

// Mesmo fluxo executado pelas Server Actions, com dependência de persistência testável.
export async function executeCategoryCommand(profile: PermissionProfile, repository: CategoryRepository, command: Command): Promise<CategoryResult> {
  const permissions = catalogPermissions(profile);
  if (!(command.type === "delete" ? permissions.canDelete : permissions.canManage)) {
    return { success: false, message: categoryError("42501") };
  }
  try {
    const id = command.type === "create" ? undefined : categoryIdSchema.safeParse(command.id);
    if (id && !id.success) return { success: false, message: "Identificador de categoria inválido." };
    let result: DbResult;
    if (command.type === "delete") {
      if (!id?.success) return { success: false, message: "Identificador de categoria inválido." };
      result = await repository.remove(id.data);
    } else {
      const values = categorySchema.safeParse(command.values);
      if (!values.success) return { success: false, message: "Informe um nome válido para a categoria." };
      if (command.type === "create") result = await repository.create(values.data.name);
      else {
        if (!id?.success) return { success: false, message: "Identificador de categoria inválido." };
        result = await repository.update(id.data, values.data.name);
      }
    }
    if (result.failed || result.errorCode) return { success: false, message: categoryError(result.errorCode) };
    if (!result.id) return { success: false, message: "Categoria não encontrada ou acesso não permitido. Atualize a listagem." };
    return { success: true };
  } catch {
    return { success: false, message: categoryError() };
  }
}