import { z } from "zod";

const requiredName = z.string().trim().min(1, "Informe o nome.");
const optionalText = z.string().trim();
// Formato apenas: sem consulta externa ou cálculo de dígitos verificadores.
export const documentFormat = /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2}|[A-Z0-9]{12}\d{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2})$/i;
export const sectorSchema = z.object({ name: requiredName }).strict();
export const supplierSchema = z.object({
  fantasy_name: requiredName,
  legal_name: optionalText,
  cnpj_cpf: optionalText.refine((value) => !value || documentFormat.test(value), "Informe CPF ou CNPJ no formato correto, com ou sem máscara."),
}).strict();
export const collaboratorSchema = z.object({
  name: requiredName, identification: optionalText, role_function: optionalText, phone: optionalText,
}).strict();
export const academicSchema = z.object({ name: requiredName, ra: optionalText, course: optionalText, phone: optionalText.optional() }).strict();
export const catalogEntitySchema = z.enum(["sectors", "suppliers", "collaborators", "academics"]);
export const catalogIdSchema = z.string().uuid("Identificador inválido.");
export type CatalogEntity = z.infer<typeof catalogEntitySchema>;
export type CatalogValues = Record<string, string>;
export type CatalogRecord = { id: string } & Record<string, string | null>;
export type CatalogResult = { success: true } | { success: false; message: string };

type Field = { name: string; label: string; required?: boolean; help?: string };
type CatalogConfig = {
  title: string; singular: string; newTitle: string; editTitle: string;
  nameColumn: string; fields: Field[]; schema: z.ZodType<CatalogValues, CatalogValues>;
};
export const catalogs: Record<CatalogEntity, CatalogConfig> = {
  sectors: {
    title: "Setores", singular: "Setor", newTitle: "Novo setor", editTitle: "Editar setor", nameColumn: "name",
    fields: [{ name: "name", label: "Nome", required: true }], schema: sectorSchema,
  },
  suppliers: {
    title: "Fornecedores", singular: "Fornecedor", newTitle: "Novo fornecedor", editTitle: "Editar fornecedor", nameColumn: "fantasy_name",
    fields: [{ name: "fantasy_name", label: "Nome fantasia", required: true }, { name: "legal_name", label: "Razão social" },
      { name: "cnpj_cpf", label: "CPF/CNPJ", help: "Com ou sem máscara. Apenas o formato será validado, sem consulta cadastral ou verificação dos dígitos." }], schema: supplierSchema,
  },
  collaborators: {
    title: "Colaboradores", singular: "Colaborador", newTitle: "Novo colaborador", editTitle: "Editar colaborador", nameColumn: "name",
    fields: [{ name: "name", label: "Nome", required: true }, { name: "identification", label: "Identificação" },
      { name: "role_function", label: "Função" }, { name: "phone", label: "Telefone" }], schema: collaboratorSchema,
  },
  academics: {
    title: "Acadêmicos", singular: "Acadêmico", newTitle: "Novo acadêmico", editTitle: "Editar acadêmico", nameColumn: "name",
    fields: [{ name: "name", label: "Nome", required: true }, { name: "ra", label: "RA" }, { name: "course", label: "Curso" }, { name: "phone", label: "Telefone" }], schema: academicSchema,
  },
};

export function catalogError(entity: CatalogEntity, code?: string) {
  if (code === "23505") return entity === "sectors" ? "Já existe um setor com este nome." : "Já existe um registro com estes dados.";
  if (code === "23503") return "Este registro possui vínculos e não pode ser excluído.";
  if (code === "42501") return "Você não tem permissão para realizar esta operação.";
  if (code === "23514") return "Confira os campos obrigatórios e o formato dos dados informados.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

// Campos opcionais vazios voltam a NULL; somente campos aprovados chegam ao banco.
export function catalogPayload(entity: CatalogEntity, values: CatalogValues) {
  return Object.fromEntries(catalogs[entity].fields.map((field) => [field.name,
    field.required ? values[field.name] : values[field.name] || null]));
}