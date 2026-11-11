import "server-only";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { catalogRepository } from "./repository";
import { executeCatalogCommand, type CatalogCommand } from "./service";
import type { CatalogEntity } from "./schema";

export async function mutateCatalog(entity: CatalogEntity, command: CatalogCommand) {
  const profile = await requireProfile();
  const result = await executeCatalogCommand(entity, profile, await catalogRepository(entity), command);
  if (result.success) {
    revalidatePath(`/${entity}`);
    if (command.type === "update") revalidatePath(`/${entity}/${command.id}/edit`);
  }
  return result;
}