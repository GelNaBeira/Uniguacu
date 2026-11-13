import { ResourceListPage, type ResourceSearchParams } from "@/components/resources/resource-pages";
import { deleteKey } from "./actions";
export const metadata = { title: "Chaves" };
export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) { return <ResourceListPage entity="keys" searchParams={searchParams} deleteAction={deleteKey} />; }