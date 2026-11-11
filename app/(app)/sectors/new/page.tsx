import { CatalogNewPage } from "@/components/catalogs/catalog-pages";
import { createSector } from "../actions";
export const metadata = { title: "Novo setor" };
export default function Page() { return <CatalogNewPage entity="sectors" saveAction={createSector} />; }