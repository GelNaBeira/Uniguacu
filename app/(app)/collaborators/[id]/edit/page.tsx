import { CatalogEditPage, type CatalogEditParams } from "@/components/catalogs/catalog-pages";
import { updateCollaborator } from "../../actions";
export const metadata = { title: "Editar colaborador" };
export default function Page({ params }: { params: CatalogEditParams }) { return <CatalogEditPage entity="collaborators" params={params} updateAction={updateCollaborator} />; }