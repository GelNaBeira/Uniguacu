"use client";
import { Button } from "@/components/ui/button";
export function CatalogError({ reset }: { reset: () => void }) {
  return <section role="alert"><h1 className="display-heading text-3xl">Não foi possível carregar o cadastro.</h1><p className="my-5 text-muted-foreground">Verifique sua conexão e tente novamente. Se o problema persistir, contate a equipe técnica.</p><Button onClick={reset}>Tentar novamente</Button></section>;
}