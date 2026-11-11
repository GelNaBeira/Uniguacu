import type { ComponentProps } from "react";
import type { ProductOption } from "@/lib/products/options";
import { Select } from "@/components/ui/select";

export function RelationSelect({ options, ...props }: ComponentProps<"select"> & { options: ProductOption[] }) {
  return <Select {...props}><option value="">Não informado</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>;
}