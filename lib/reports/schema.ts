import { z } from "zod";
import { loanDetailsSchema } from "../lending/filters.ts";
import { parseLendingQuery } from "../lending/pagination.ts";

export const reportSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("general"), format: z.enum(["pdf", "xlsx"]) }).strict(),
  z.object({ scope: z.literal("operational"), format: z.enum(["pdf", "xlsx"]),
    filters: z.object({ status: z.string(), kind: z.string(), details: loanDetailsSchema }).strict()
      .refine((v) => !parseLendingQuery({ status: v.status, kind: v.kind }).invalid, "Filtros inválidos."),
  }).strict(),
]);
export type ReportInput = z.infer<typeof reportSchema>;
export type ReportTable = { name: string; columns: string[]; rows: (string | number)[][] };
export type ReportDocument = { title: string; summary: string; generatedAt: string; tables: ReportTable[] };
export type ReportResult = { success: true; base64: string; filename: string; mime: string } | { success: false; message: string };