"use server";
import { mutateResource } from "@/lib/resources/mutations";
export async function createCar(values: unknown) { return mutateResource("cars", { type: "create", values }); }
export async function updateCar(id: unknown, values: unknown) { return mutateResource("cars", { type: "update", id, values }); }
export async function deleteCar(id: unknown) { return mutateResource("cars", { type: "delete", id }); }