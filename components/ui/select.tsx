import * as React from "react";
import { cn } from "@/lib/utils";
// Select nativo acessível, compatível com register/ref do React 19/RHF.
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn("h-12 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50", className)} {...props} />;
}