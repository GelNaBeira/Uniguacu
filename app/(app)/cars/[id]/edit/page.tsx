import { ResourceEditPage, type ResourceEditParams } from "@/components/resources/resource-pages";
import { updateCar } from "../../actions";
export const metadata = { title: "Editar carro" };
export default function Page({ params }: { params: ResourceEditParams }) { return <ResourceEditPage entity="cars" params={params} updateAction={updateCar} />; }