"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { categoryRepository } from "@/lib/categories/repository";
import { executeCategoryCommand } from "@/lib/categories/service";
import type { CategoryResult } from "@/lib/categories/schema";
import { catalogPermissions } from "@/lib/auth/permissions";
import { authDiagnostic } from "@/lib/auth/diagnostics";

async function categoryContext(operation: "create" | "update" | "delete") {
  const requestId = crypto.randomUUID();
  const profile = await requireProfile(requestId);
  const permissions = catalogPermissions(profile);
  authDiagnostic("categories.authorization", {
    requestId, operation, userId: profile.id, role: profile.role, isActive: profile.is_active,
    canManage: permissions.canManage, canDelete: permissions.canDelete,
    allowed: operation === "delete" ? permissions.canDelete : permissions.canManage,
  });
  const repository = await categoryRepository((event) => {
    authDiagnostic("categories.database", { requestId, userId: profile.id, ...event });
  }, requestId);
  return { profile, repository };
}

export async function createCategory(values: unknown): Promise<CategoryResult> {
  const { profile, repository } = await categoryContext("create");
  const result = await executeCategoryCommand(profile, repository, { type: "create", values });
  if (result.success) revalidatePath("/categories");
  return result;
}
export async function updateCategory(id: unknown, values: unknown): Promise<CategoryResult> {
  const { profile, repository } = await categoryContext("update");
  const result = await executeCategoryCommand(profile, repository, { type: "update", id, values });
  if (result.success) { revalidatePath("/categories"); revalidatePath(`/categories/${id}/edit`); }
  return result;
}
export async function deleteCategory(id: unknown): Promise<CategoryResult> {
  const { profile, repository } = await categoryContext("delete");
  const result = await executeCategoryCommand(profile, repository, { type: "delete", id });
  if (result.success) revalidatePath("/categories");
  return result;
}