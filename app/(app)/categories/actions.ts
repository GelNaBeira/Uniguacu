"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { categoryRepository } from "@/lib/categories/repository";
import { executeCategoryCommand } from "@/lib/categories/service";
import type { CategoryResult } from "@/lib/categories/schema";

export async function createCategory(values: unknown): Promise<CategoryResult> {
  const profile = await requireProfile();
  const result = await executeCategoryCommand(profile, await categoryRepository(), { type: "create", values });
  if (result.success) revalidatePath("/categories");
  return result;
}
export async function updateCategory(id: unknown, values: unknown): Promise<CategoryResult> {
  const profile = await requireProfile();
  const result = await executeCategoryCommand(profile, await categoryRepository(), { type: "update", id, values });
  if (result.success) { revalidatePath("/categories"); revalidatePath(`/categories/${id}/edit`); }
  return result;
}
export async function deleteCategory(id: unknown): Promise<CategoryResult> {
  const profile = await requireProfile();
  const result = await executeCategoryCommand(profile, await categoryRepository(), { type: "delete", id });
  if (result.success) revalidatePath("/categories");
  return result;
}