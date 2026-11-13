import { parseCategoryQuery } from "../categories/pagination.ts";
import { resourceStatusSchema, type ResourceEntity } from "./schema.ts";
export { PAGE_SIZE, pageRange, escapeLike } from "../categories/pagination.ts";
export function parseResourceQuery(params: Record<string, string | string[] | undefined>) {
  const status = typeof params.status === "string" ? params.status : "";
  return { ...parseCategoryQuery(params), status, invalid: !!status && !resourceStatusSchema.safeParse(status).success };
}
export function resourceListUrl(entity: ResourceEntity, page: number, query: string, status = "") {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  return `/${entity}?${params}`;
}