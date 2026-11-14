import { reportPermissions, type PermissionProfile } from "../auth/permissions.ts";
import { reportSchema, type ReportDocument, type ReportInput, type ReportResult } from "./schema.ts";

export async function executeReport(profile: PermissionProfile, input: unknown, dependencies: {
  load: (input: ReportInput) => Promise<ReportDocument>;
  render: (document: ReportDocument, format: "pdf" | "xlsx") => Promise<{ base64: string; mime: string }>;
}): Promise<ReportResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Filtros ou formato de relatório inválidos." };
  const value = parsed.data;
  if (!reportPermissions(profile)[value.scope]) return { success: false, message: "Você não tem permissão para gerar este relatório." };
  try {
    const document = await dependencies.load(value);
    const file = await dependencies.render(document, value.format);
    if (file.base64.length > 24 * 1024 * 1024) return { success: false, message: "Arquivo muito grande. Reduza os filtros do relatório." };
    return { success: true, ...file, filename: `relatorio-${value.scope === "general" ? "geral" : "operacional"}-${document.generatedAt.slice(0, 10)}.${value.format}` };
  } catch {
    return { success: false, message: "Não foi possível gerar o relatório completo. Tente novamente ou reduza o período/filtros (limite de 10.000 registros por seção)." };
  }
}