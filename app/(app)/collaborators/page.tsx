import { CatalogListPage, type CatalogSearchParams } from "@/components/catalogs/catalog-pages";
import { deleteCollaborator } from "./actions";
export const metadata = { title: "Colaboradores" };
export default function Page({ searchParams }: { searchParams: CatalogSearchParams }) { return <CatalogListPage entity="collaborators" searchParams={searchParams} deleteAction={deleteCollaborator} />; }