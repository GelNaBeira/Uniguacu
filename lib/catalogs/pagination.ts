// Reutiliza o comportamento de busca/paginação do template homologado.
export { PAGE_SIZE, parseCategoryQuery as parseCatalogQuery, pageRange, escapeLike } from "../categories/pagination.ts";
import type { CatalogEntity } from "./schema.ts";

export function catalogListUrl(entity: CatalogEntity, page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/${entity}?${params}`;
}