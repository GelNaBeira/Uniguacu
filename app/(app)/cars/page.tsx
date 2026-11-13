import { ResourceListPage, type ResourceSearchParams } from "@/components/resources/resource-pages";
import { deleteCar } from "./actions";
export const metadata = { title: "Carros" };
export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) { return <ResourceListPage entity="cars" searchParams={searchParams} deleteAction={deleteCar} />; }