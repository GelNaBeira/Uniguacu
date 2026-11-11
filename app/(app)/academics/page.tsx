import { CatalogListPage, type CatalogSearchParams } from "@/components/catalogs/catalog-pages";
import { deleteAcademic } from "./actions";
export const metadata = { title: "Acadêmicos" };
export default function Page({ searchParams }: { searchParams: CatalogSearchParams }) { return <CatalogListPage entity="academics" searchParams={searchParams} deleteAction={deleteAcademic} />; }