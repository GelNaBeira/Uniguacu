import "server-only";
import { createClient } from "@/lib/supabase/server";
export type ProductOption = { id: string; label: string };
export type ProductOptions = { categories: ProductOption[]; sectors: ProductOption[]; suppliers: ProductOption[] };

// Percorre todas as páginas; não trunca silenciosamente no limite de resposta do Supabase.
export async function loadProductOptions(): Promise<ProductOptions> {
  const client = await createClient();
  async function read(table: "categories" | "sectors" | "suppliers") {
    const column = table === "suppliers" ? "fantasy_name" : "name";
    const options: ProductOption[] = [];
    const size = 100;
    for (let from = 0; ; from += size) {
      const { data, error } = await client.from(table).select(`id,${column}`).order(column).order("id").range(from, from + size - 1);
      if (error || !data) throw new Error("Não foi possível carregar as opções de produtos.");
      const rows = data as unknown as Record<string, string>[];
      options.push(...rows.map((row) => ({ id: row.id, label: row[column] })));
      if (rows.length < size) break;
    }
    return options;
  }
  const [categories, sectors, suppliers] = await Promise.all([read("categories"), read("sectors"), read("suppliers")]);
  return { categories, sectors, suppliers };
}