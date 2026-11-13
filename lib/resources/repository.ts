import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resources, resourceEntitySchema, type ResourceEntity } from "./schema";
import type { ResourceRepository } from "./service";

export async function resourceRepository(entity: ResourceEntity): Promise<ResourceRepository> {
  const table = resources[resourceEntitySchema.parse(entity)].table;
  const client = await createClient();
  return {
    async create(values) {
      const { data, error } = await client.from(table).insert(values).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async update(id, values) {
      const { data, error } = await client.from(table).update({ name: values.name }).eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async correctCar(id, values) {
      const { data, error } = await client.rpc("admin_update_car_registration", { p_id: id, p_name: values.name, p_mileage: values.mileage ?? null });
      return { id: typeof data === "string" ? data : null, failed: !!error, errorCode: error?.code };
    },
    async remove(id) {
      const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
  };
}