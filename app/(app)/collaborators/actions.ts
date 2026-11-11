"use server";
import { mutateCatalog } from "@/lib/catalogs/mutations";
export async function createCollaborator(values: unknown) { return mutateCatalog("collaborators", { type: "create", values }); }
export async function updateCollaborator(id: unknown, values: unknown) { return mutateCatalog("collaborators", { type: "update", id, values }); }
export async function deleteCollaborator(id: unknown) { return mutateCatalog("collaborators", { type: "delete", id }); }