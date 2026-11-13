import { ResourceNewPage } from "@/components/resources/resource-pages";
import { createKey } from "../actions";
export const metadata = { title: "Nova chave" };
export default function Page() { return <ResourceNewPage entity="keys" saveAction={createKey} />; }