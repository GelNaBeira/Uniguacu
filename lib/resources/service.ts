import { resourcePermissions, type PermissionProfile } from "../auth/permissions.ts";
import { resourceEntitySchema, resourceSchema, resourceIdSchema, resourceError, type ResourceValues, type ResourceResult } from "./schema.ts";

type DbResult = { id: string | null; failed?: boolean; errorCode?: string };
export type ResourceRepository = {
  create: (values: ResourceValues) => Promise<DbResult>;
  update: (id: string, values: ResourceValues) => Promise<DbResult>;
  correctCar: (id: string, values: ResourceValues) => Promise<DbResult>;
  remove: (id: string) => Promise<DbResult>;
};
export type ResourceCommand = { type: "create"; values: unknown } | { type: "update"; id: unknown; values: unknown } | { type: "delete"; id: unknown };
export async function executeResourceCommand(entityInput: unknown, profile: PermissionProfile, repository: ResourceRepository, command: ResourceCommand): Promise<ResourceResult> {
  const entity = resourceEntitySchema.safeParse(entityInput);
  if (!entity.success) return { success: false, message: "Cadastro inválido." };
  const permissions = resourcePermissions(profile, entity.data);
  if (!(command.type === "delete" ? permissions.canDelete : permissions.canManage)) return { success: false, message: resourceError("42501") };
  try {
    const id = command.type === "create" ? undefined : resourceIdSchema.safeParse(command.id);
    if (id && !id.success) return { success: false, message: "Identificador inválido." };
    let result: DbResult;
    if (command.type === "delete") {
      if (!id?.success) return { success: false, message: "Identificador inválido." };
      result = await repository.remove(id.data);
    } else {
      const values = resourceSchema(entity.data, command.type === "update", permissions.canCorrectMileage).safeParse(command.values);
      if (!values.success) return { success: false, message: values.error.issues[0]?.message ?? "Confira os dados." };
      // O schema strict rejeita status, IDs e mileage na edição de USER.
      if (command.type === "create") result = await repository.create(values.data);
      else {
        if (!id?.success) return { success: false, message: "Identificador inválido." };
        result = entity.data === "cars" && permissions.canCorrectMileage
          ? await repository.correctCar(id.data, values.data) : await repository.update(id.data, values.data);
      }
    }
    if (result.failed || result.errorCode) return { success: false, message: resourceError(result.errorCode) };
    if (!result.id) return { success: false, message: "Cadastro não encontrado ou acesso não permitido. Atualize a listagem." };
    return { success: true };
  } catch { return { success: false, message: resourceError() }; }
}