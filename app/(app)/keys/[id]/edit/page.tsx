import { ResourceEditPage, type ResourceEditParams } from "@/components/resources/resource-pages";
import { updateKey } from "../../actions";
export const metadata = { title: "Editar chave" };
export default function Page({ params }: { params: ResourceEditParams }) { return <ResourceEditPage entity="keys" params={params} updateAction={updateKey} />; }