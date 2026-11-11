import { CatalogListPage, type CatalogSearchParams } from "@/components/catalogs/catalog-pages";
import { deleteSupplier } from "./actions";
export const metadata = { title: "Fornecedores" };
export default function Page({ searchParams }: { searchParams: CatalogSearchParams }) { return <CatalogListPage entity="suppliers" searchParams={searchParams} deleteAction={deleteSupplier} />; }