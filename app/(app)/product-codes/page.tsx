import { requireProfile } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
export default async function ProductCodes() {
  await requireProfile();
  return <><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">PRODUTOS / CÓDIGOS</p><h1 className="display-heading mt-3 text-4xl">Códigos de produtos</h1><Card className="mt-8 max-w-2xl p-8"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">PREVISTO PARA EVOLUÇÃO</span><h2 className="display-heading mt-6 text-3xl">Funcionalidade em desenvolvimento</h2><p className="mt-4 leading-7 text-muted-foreground">No MVP, o estoque será controlado apenas pela quantidade (qtd). Não haverá controle de código de barras individual por exemplar.</p></Card></>;
}