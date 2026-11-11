import { CatalogEditPage, type CatalogEditParams } from "@/components/catalogs/catalog-pages";
import { updateSector } from "../../actions";
export const metadata = { title: "Editar setor" };
export default function Page({ params }: { params: CatalogEditParams }) { return <CatalogEditPage entity="sectors" params={params} updateAction={updateSector} />; }