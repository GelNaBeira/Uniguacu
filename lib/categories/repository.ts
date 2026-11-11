import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRepository } from "./service";

export async function categoryRepository(): Promise<CategoryRepository> {
  const client = await createClient();
  return {
    async create(name) {
      const { data, error } = await client.from("categories").insert({ name }).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async update(id, name) {
      const { data, error } = await client.from("categories").update({ name }).eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async remove(id) {
      const { data, error } = await client.from("categories").delete().eq("id", id).select("id").maybeSingle();
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
  };
}