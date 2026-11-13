import { ResourceNewPage } from "@/components/resources/resource-pages";
import { createCar } from "../actions";
export const metadata = { title: "Novo carro" };
export default function Page() { return <ResourceNewPage entity="cars" saveAction={createCar} />; }