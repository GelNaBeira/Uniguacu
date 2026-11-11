"use server";
import { mutateCatalog } from "@/lib/catalogs/mutations";
export async function createSupplier(values: unknown) { return mutateCatalog("suppliers", { type: "create", values }); }
export async function updateSupplier(id: unknown, values: unknown) { return mutateCatalog("suppliers", { type: "update", id, values }); }
export async function deleteSupplier(id: unknown) { return mutateCatalog("suppliers", { type: "delete", id }); }