"use server";
import { mutateCatalog } from "@/lib/catalogs/mutations";
export async function createSector(values: unknown) { return mutateCatalog("sectors", { type: "create", values }); }
export async function updateSector(id: unknown, values: unknown) { return mutateCatalog("sectors", { type: "update", id, values }); }
export async function deleteSector(id: unknown) { return mutateCatalog("sectors", { type: "delete", id }); }