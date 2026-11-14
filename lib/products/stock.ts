import { z } from "zod";
export const stockEntrySchema = z.object({
  productId: z.string().uuid(), requestId: z.string().uuid(),
  quantity: z.number().int().min(1).max(2147483647),
  date: z.string().date("Informe uma data válida."),
  note: z.string().trim().max(2000, "A nota deve ter até 2000 caracteres."),
}).strict();
export type StockEntryInput = z.infer<typeof stockEntrySchema>;