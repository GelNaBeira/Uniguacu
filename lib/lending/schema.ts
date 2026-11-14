import { z } from "zod";

export const kinds = ["product", "key", "car"] as const;
export const kindSchema = z.enum(kinds);
export type LendingKind = z.infer<typeof kindSchema>;
export const kindLabels = { product: "Produto", key: "Chave", car: "Carro" } as const;
export const statusLabels = { EM_ANDAMENTO: "Em andamento", ATRASADO: "Atrasado", DEVOLVIDO: "Devolvido", SEM_DEVOLUCAO: "Consumo registrado" } as const;
export const uuidSchema = z.string().uuid("Selecione um identificador válido.");
const integer = z.number().int("Informe um número inteiro.").min(0, "O valor não pode ser negativo.").max(2147483647, "Valor acima do limite permitido.");
const common = { resourceId: uuidSchema, collaboratorId: uuidSchema.nullish(), academicId: uuidSchema.nullish(), requestId: uuidSchema };
export const lendSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("product"), quantity: integer.min(1, "Informe uma quantidade positiva.") }).strict(),
  z.object({ ...common, kind: z.literal("key") }).strict(),
  z.object({ ...common, kind: z.literal("car"), kmOut: integer }).strict(),
]).refine((value) => !!value.collaboratorId !== !!value.academicId, {
  message: "Selecione exatamente um destinatário: colaborador ou acadêmico.", path: ["collaboratorId"],
});
export const returnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("product"), loanId: uuidSchema }).strict(),
  z.object({ kind: z.literal("key"), loanId: uuidSchema }).strict(),
  z.object({ kind: z.literal("car"), loanId: uuidSchema, kmIn: integer }).strict(),
]);
export type LendInput = z.infer<typeof lendSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;
export type LendingResult = { success: true; id: string } | { success: false; message: string; uncertain: boolean };
export type LendingOption = { id: string; name: string; qtd?: number; mileage?: number | null; is_consumable?: boolean };
export function selectedLendError(input: LendInput, resource: LendingOption | null): string | null {
  if (!resource || resource.id !== input.resourceId) return "Selecione um item válido.";
  if (input.kind === "product" && input.quantity > (resource.qtd ?? 0)) return "A quantidade excede o estoque consultado. Atualize as opções.";
  if (input.kind === "car" && input.kmOut < (resource.mileage ?? 0)) return "O KM de saída não pode ser inferior ao odômetro cadastrado.";
  return null;
}
export type LookupResult = { success: true; rows: LendingOption[]; page: number; pages: number; count: number } | { success: false; message: string };
export type LoanRow = {
  id: string; kind: LendingKind; itemName: string; recipientName: string; recipientType: "collaborator" | "academic" | null;
  out_date: string; out_at: string | null; status: string | null; created_by: string | null;
  request_id: string | null; quantity: number | null; km_out: number | null; no_return: boolean | null;
};
export function isReturnable(row: LoanRow, actor: string, permissions: { canReturn: boolean; canViewAll: boolean }) {
  return permissions.canReturn && (permissions.canViewAll || row.created_by === actor)
    && ["EM_ANDAMENTO", "ATRASADO"].includes(row.status ?? "")
    && !!row.out_at && !!row.request_id && (row.kind !== "product" || row.no_return === false);
}
export function lendingError(code?: string): { message: string; uncertain: boolean } {
  const messages: Record<string, string> = {
    "42501": "Você não tem permissão para realizar esta operação. Atualize a página.",
    "22023": "Confira os dados. Uma requisição já utilizada não pode ser alterada.",
    "23514": "Estoque, disponibilidade, estado do empréstimo ou quilometragem não permitem esta operação. Atualize a consulta.",
    "23503": "O item ou destinatário não está mais disponível. Atualize a consulta.",
    "P0002": "Empréstimo ou item não encontrado ou não disponível para seu acesso.",
    "22003": "Quantidade ou quilometragem acima do limite permitido.",
  };
  return code && messages[code] ? { message: messages[code], uncertain: false }
    : { message: "Não foi possível confirmar a operação. Repita esta mesma tentativa; não crie outra retirada antes de confirmar o resultado.", uncertain: true };
}