import "server-only";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { resourceRepository } from "./repository";
import { executeResourceCommand, type ResourceCommand } from "./service";
import type { ResourceEntity } from "./schema";

export async function mutateResource(entity: ResourceEntity, command: ResourceCommand) {
  const profile = await requireProfile();
  const result = await executeResourceCommand(entity, profile, await resourceRepository(entity), command);
  if (result.success) {
    revalidatePath(`/${entity}`);
    if (command.type === "update") revalidatePath(`/${entity}/${command.id}/edit`);
  }
  return result;
}