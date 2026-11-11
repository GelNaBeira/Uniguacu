import { z } from "zod";

export const categorySchema = z.object({ name: z.string().trim().min(1, "Informe o nome da categoria.") }).strict();
export const categoryIdSchema = z.string().uuid("Identificador de categoria inválido.");
export type CategoryValues = z.infer<typeof categorySchema>;
export type Category = CategoryValues & { id: string };
export type CategoryResult = { success: true } | { success: false; message: string };

export function categoryError(code?: string) {
  if (code === "23505") return "Já existe uma categoria com este nome.";
  if (code === "23503") return "Esta categoria está vinculada a produtos e não pode ser excluída.";
  if (code === "42501") return "Você não tem permissão para realizar esta operação.";
  if (code === "23514") return "Informe um nome válido para a categoria.";
  return "Não foi possível concluir a operação. Tente novamente.";
}