import { z } from "zod";
import { parseCategoryQuery } from "../categories/pagination.ts";
export { PAGE_SIZE, pageRange, escapeLike } from "../categories/pagination.ts";
type Params = Record<string, string | string[] | undefined>;
export function parseProductQuery(params: Params) {
  const category = typeof params.category === "string" ? params.category : "";
  const sector = typeof params.sector === "string" ? params.sector : "";
  const invalid = (!!category && !z.string().uuid().safeParse(category).success) || (!!sector && !z.string().uuid().safeParse(sector).success);
  return { ...parseCategoryQuery(params), category, sector, invalid };
}
export function productListUrl(page: number, query: string, category: string, sector: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (sector) params.set("sector", sector);
  return `/products?${params}`;
}