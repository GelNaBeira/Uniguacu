export const PAGE_SIZE = 10;

export function parseCategoryQuery(input: { page?: string | string[]; q?: string | string[] }) {
  const raw = typeof input.page === "string" ? input.page : "1";
  const value = Number(raw);
  const page = /^\d+$/.test(raw) && Number.isSafeInteger(value) && value > 0 ? value : 1;
  return { page, query: typeof input.q === "string" ? input.q.trim() : "" };
}
export function pageRange(page: number) {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}
export function categoryListUrl(page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/categories?${params}`;
}
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}