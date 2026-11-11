import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRepository } from "./service";

type DatabaseDiagnostic = (event: { operation: string; code: string | null; message: string | null; returnedId: string | null }) => void;
export async function categoryRepository(diagnose?: DatabaseDiagnostic, diagnosticRequestId?: string): Promise<CategoryRepository> {
  const client = await createClient(diagnosticRequestId);
  return {
    async create(name) {
      const { data, error } = await client.from("categories").insert({ name }).select("id").maybeSingle();
      diagnose?.({ operation: "create", code: error?.code ?? null, message: error?.message ?? null, returnedId: data?.id ?? null });
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async update(id, name) {
      const { data, error } = await client.from("categories").update({ name }).eq("id", id).select("id").maybeSingle();
      diagnose?.({ operation: "update", code: error?.code ?? null, message: error?.message ?? null, returnedId: data?.id ?? null });
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
    async remove(id) {
      const { data, error } = await client.from("categories").delete().eq("id", id).select("id").maybeSingle();
      diagnose?.({ operation: "delete", code: error?.code ?? null, message: error?.message ?? null, returnedId: data?.id ?? null });
      return { id: data?.id ?? null, failed: !!error, errorCode: error?.code };
    },
  };
}