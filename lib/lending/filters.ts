import { z } from "zod";

const date = z.union([z.literal(""), z.iso.date()]).default("");
export const loanDetailsSchema = z.object({
  start: date, end: date,
  recipientType: z.enum(["", "collaborator", "academic"]).default(""),
  recipient: z.string().trim().max(100).default(""),
}).strict().refine((v) => !v.start || !v.end || v.start <= v.end, "Período inválido.")
  .refine((v) => !v.recipient || !!v.recipientType, "Selecione o vínculo para buscar por nome.");
export type LoanDetails = z.infer<typeof loanDetailsSchema>;
export function parseLoanDetails(params: Record<string, string | string[] | undefined>) {
  return loanDetailsSchema.safeParse(Object.fromEntries(["start", "end", "recipientType", "recipient"].map((key) => [key, params[key] ?? ""])));
}
export function escapeLike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}