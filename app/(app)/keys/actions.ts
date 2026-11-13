"use server";
import { mutateResource } from "@/lib/resources/mutations";
export async function createKey(values: unknown) { return mutateResource("keys", { type: "create", values }); }
export async function updateKey(id: unknown, values: unknown) { return mutateResource("keys", { type: "update", id, values }); }
export async function deleteKey(id: unknown) { return mutateResource("keys", { type: "delete", id }); }