import { CatalogEditPage, type CatalogEditParams } from "@/components/catalogs/catalog-pages";
import { updateAcademic } from "../../actions";
export const metadata = { title: "Editar acadêmico" };
export default function Page({ params }: { params: CatalogEditParams }) { return <CatalogEditPage entity="academics" params={params} updateAction={updateAcademic} />; }