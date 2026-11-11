import { CatalogEditPage, type CatalogEditParams } from "@/components/catalogs/catalog-pages";
import { updateSupplier } from "../../actions";
export const metadata = { title: "Editar fornecedor" };
export default function Page({ params }: { params: CatalogEditParams }) { return <CatalogEditPage entity="suppliers" params={params} updateAction={updateSupplier} />; }