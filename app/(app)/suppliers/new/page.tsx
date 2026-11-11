import { CatalogNewPage } from "@/components/catalogs/catalog-pages";
import { createSupplier } from "../actions";
export const metadata = { title: "Novo fornecedor" };
export default function Page() { return <CatalogNewPage entity="suppliers" saveAction={createSupplier} />; }