"use server";
import { mutateCatalog } from "@/lib/catalogs/mutations";
export async function createAcademic(values: unknown) { return mutateCatalog("academics", { type: "create", values }); }
export async function updateAcademic(id: unknown, values: unknown) { return mutateCatalog("academics", { type: "update", id, values }); }
export async function deleteAcademic(id: unknown) { return mutateCatalog("academics", { type: "delete", id }); }