import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRepository } from "./service";
export async function productRepository(): Promise<ProductRepository> {
  const client = await createClient();
  return {
    async create(values) {
      const { data, error } = await client.from("products").insert(values).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async update(id, values) {
      const { data, error } = await client.from("products").update(values).eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async remove(id) {
      const { data, error } = await client.from("products").delete().eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
  };
}