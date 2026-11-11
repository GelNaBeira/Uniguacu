import { CatalogNewPage } from "@/components/catalogs/catalog-pages";
import { createCollaborator } from "../actions";
export const metadata = { title: "Novo colaborador" };
export default function Page() { return <CatalogNewPage entity="collaborators" saveAction={createCollaborator} />; }