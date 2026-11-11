import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
export default async function Home() {
  await requireProfile();
  return <><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">ESPAÇO DE TRABALHO</p><h1 className="display-heading mt-3 text-5xl">Almoxarifado</h1><p className="mt-4 max-w-xl leading-7 text-muted-foreground">Materiais, chaves e carros. A base para acompanhar os recursos da instituição com segurança.</p><Card className="mt-10 max-w-3xl border-t-4 border-t-primary p-8"><p className="text-xs font-semibold tracking-[.15em] text-muted-foreground">MARCO 1 / BASE DO SISTEMA</p><h2 className="display-heading mt-4 text-3xl">Um início organizado.</h2><p className="mt-4 leading-7 text-muted-foreground">Autenticação e estrutura de navegação disponíveis. Cadastros, empréstimos e devoluções serão liberados nos próximos marcos, após validação das respectivas regras.</p><div className="mt-6 border-t border-border pt-5 text-sm"><Link className="font-semibold text-primary underline underline-offset-4" href="/product-codes">Consultar disponibilidade de códigos →</Link></div></Card></>;
}