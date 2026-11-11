import "server-only";
import { createClient } from "@/lib/supabase/server";
import { catalogEntitySchema, type CatalogEntity } from "./schema";
import type { CatalogRepository } from "./service";

export async function catalogRepository(entity: CatalogEntity): Promise<CatalogRepository> {
  const table = catalogEntitySchema.parse(entity);
  const client = await createClient();
  return {
    async create(values) {
      const { data, error } = await client.from(table).insert(values).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async update(id, values) {
      const { data, error } = await client.from(table).update(values).eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async remove(id) {
      const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
  };
}