import { z } from "zod";

export const resourceEntitySchema = z.enum(["keys", "cars"]);
export type ResourceEntity = z.infer<typeof resourceEntitySchema>;
export const resourceIdSchema = z.string().uuid("Identificador inválido.");
export const resourceStatusSchema = z.enum(["DISPONIVEL", "INDISPONIVEL"]);
export const mileageSchema = z.number().int("Informe uma quilometragem inteira.").min(0, "A quilometragem não pode ser negativa.").max(2147483647, "Quilometragem acima do limite permitido.").nullable();
export const keySchema = z.object({ name: z.string().trim().min(1, "Informe o nome.") }).strict();
export const carSchema = keySchema.extend({ mileage: mileageSchema }).strict();
export type ResourceValues = { name: string; mileage?: number | null };
export type ResourceRecord = { id: string; name: string; status: z.infer<typeof resourceStatusSchema>; mileage?: number | null };
export type ResourceResult = { success: true } | { success: false; message: string };
export const resources = {
  keys: { table: "keys", title: "Chaves", newTitle: "Nova chave", editTitle: "Editar chave", columns: "id,name,status" },
  cars: { table: "car_keys", title: "Carros", newTitle: "Novo carro", editTitle: "Editar carro", columns: "id,name,status,mileage" },
} as const;
export function resourceSchema(entity: ResourceEntity, editing: boolean, correctMileage: boolean) {
  return entity === "cars" && (!editing || correctMileage) ? carSchema : keySchema;
}
export function resourceError(code?: string) {
  if (code === "23503") return "Este cadastro possui empréstimos vinculados e não pode ser excluído.";
  if (code === "42501") return "Você não tem permissão para realizar esta operação.";
  if (code === "23514" || code === "22003") return "Confira o nome e a quilometragem informados.";
  if (code === "23505") return "Já existe um cadastro com estes dados.";
  return "Não foi possível concluir a operação. Tente novamente.";
}