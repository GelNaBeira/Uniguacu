import type { CategoryResult, CategoryValues } from "./schema.ts";
import { categoryListUrl } from "./pagination.ts";

export function categorySavedUrl(name: string, editing: boolean) {
  const url = categoryListUrl(1, name.trim());
  return `${url}&status=${editing ? "updated" : "created"}`;
}

type SubmissionDependencies = {
  save: (values: CategoryValues) => Promise<CategoryResult>;
  showError: (message: string) => void;
  reset: () => void;
  navigate: (url: string) => void;
};

// Mantém os dados em falhas e só limpa/navega quando o INSERT/UPDATE foi confirmado.
export async function submitCategory(values: CategoryValues, editing: boolean, dependencies: SubmissionDependencies) {
  try {
    const result = await dependencies.save(values);
    if (!result.success) { dependencies.showError(result.message); return; }
    dependencies.reset();
    dependencies.navigate(categorySavedUrl(values.name, editing));
  } catch {
    dependencies.showError("Não foi possível confirmar o salvamento. Verifique sua conexão e sessão e consulte a listagem antes de tentar novamente.");
  }
}