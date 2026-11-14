"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { lendingPermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { executeLendingCommand } from "@/lib/lending/service";
import type { LendingResult, LookupResult, LendingOption } from "@/lib/lending/schema";

async function mutate(action: "lend" | "return", input: unknown): Promise<LendingResult> {
  const profile = await requireProfile();
  const client = await createClient();
  const result = await executeLendingCommand(action, profile, { rpc: async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error: error ? { code: error.code } : null };
  } }, input);
  if (result.success) {
    // O comando já foi confirmado: falha de atualização de cache não vira retry incerto.
    try { for (const path of ["/home", "/products", "/keys", "/cars"]) revalidatePath(path); } catch { /* router.refresh também atualiza a Home */ }
  }
  return result;
}
export async function lendItem(input: unknown) { return mutate("lend", input); }
export async function returnItem(input: unknown) { return mutate("return", input); }

const lookupSchema = z.object({ kind: z.enum(["product", "key", "car", "collaborator", "academic"]), query: z.string().trim().max(100), page: z.number().int().min(1).max(1000000) }).strict();
export async function lookupLendingOptions(input: unknown): Promise<LookupResult> {
  const profile = await requireProfile();
  if (!lendingPermissions(profile).canLend) return { success: false, message: "Você não tem permissão para registrar empréstimos." };
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Consulta inválida." };
  const { kind, query, page } = parsed.data;
  const config = {
    product: { table: "products", columns: "id,name,qtd,is_consumable" }, key: { table: "keys", columns: "id,name" },
    car: { table: "car_keys", columns: "id,name,mileage" }, collaborator: { table: "collaborators", columns: "id,name" },
    academic: { table: "academics", columns: "id,name" },
  }[kind];
  try {
    const client = await createClient();
    let request = client.from(config.table).select(config.columns, { count: "exact" });
    if (query) request = request.ilike("name", `%${query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
    if (kind === "product") request = request.gt("qtd", 0);
    if (kind === "key" || kind === "car") request = request.eq("status", "DISPONIVEL");
    const { data, count, error } = await request.order("name").order("id").range((page - 1) * 10, page * 10 - 1);
    if (error || !data || count === null) return { success: false, message: "Não foi possível carregar as opções. Tente novamente." };
    return { success: true, rows: data as unknown as LendingOption[], count, page, pages: Math.max(1, Math.ceil(count / 10)) };
  } catch { return { success: false, message: "Não foi possível carregar as opções. Verifique sua conexão e sessão." }; }
}