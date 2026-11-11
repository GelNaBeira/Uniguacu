import { CatalogListPage, type CatalogSearchParams } from "@/components/catalogs/catalog-pages";
import { deleteSector } from "./actions";
export const metadata = { title: "Setores" };
export default function Page({ searchParams }: { searchParams: CatalogSearchParams }) { return <CatalogListPage entity="sectors" searchParams={searchParams} deleteAction={deleteSector} />; }