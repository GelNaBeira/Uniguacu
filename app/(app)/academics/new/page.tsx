import { CatalogNewPage } from "@/components/catalogs/catalog-pages";
import { createAcademic } from "../actions";
export const metadata = { title: "Novo acadêmico" };
export default function Page() { return <CatalogNewPage entity="academics" saveAction={createAcademic} />; }