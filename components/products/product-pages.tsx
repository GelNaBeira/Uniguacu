import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { productPermissions, lendingPermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { loadProductOptions } from "@/lib/products/options";
import { PRODUCT_COLUMNS, productIdSchema, type ProductRecord } from "@/lib/products/schema";
import { parseProductQuery, productListUrl, PAGE_SIZE, pageRange, escapeLike } from "@/lib/products/pagination";
import { signedProductImage } from "@/lib/products/images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "./product-form";
import { RelationSelect } from "./relation-select";
import { ProductDelete } from "./product-delete";
import { StockEntry } from "./stock-entry";
import { NewLoan } from "@/components/lending/new-loan";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export function ProductDenied() {
  return <section><h1 className="display-heading text-4xl">Acesso não permitido</h1><p role="alert" className="my-6">Você não tem permissão para esta operação.</p><Link href="/home" className="underline">Voltar ao início</Link></section>;
}
export async function ProductListPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const permissions = productPermissions(profile);
  const canLend = lendingPermissions(profile).canLend;
  if (!permissions.canRead) return <ProductDenied />;
  const params = await searchParams;
  const { page, query, category, sector, invalid } = parseProductQuery(params);
  const options = await loadProductOptions();
  const client = await createClient();
  if (invalid) return <section><h1 className="display-heading text-4xl">Filtro inválido</h1><p role="alert" className="my-6">Selecione uma categoria ou setor válido.</p><Link href="/products" className="underline">Limpar filtros</Link></section>;
  let countRequest = client.from("products").select("id", { count: "exact", head: true });
  if (query) countRequest = countRequest.ilike("name", `%${escapeLike(query)}%`);
  if (category) countRequest = countRequest.eq("category_id", category);
  if (sector) countRequest = countRequest.eq("sector_id", sector);
  const { count, error: countError } = await countRequest;
  if (countError || count === null) throw new Error("Não foi possível consultar os produtos.");
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > pages) redirect(productListUrl(pages, query, category, sector));
  const { from, to } = pageRange(page);
  let request = client.from("products").select(PRODUCT_COLUMNS).order("name").order("id").range(from, to);
  if (query) request = request.ilike("name", `%${escapeLike(query)}%`);
  if (category) request = request.eq("category_id", category);
  if (sector) request = request.eq("sector_id", sector);
  const { data, error } = await request;
  if (error || !data) throw new Error("Não foi possível consultar os produtos.");
  const products = await Promise.all((data as ProductRecord[]).map(async (product) => ({ ...product, imageUrl: await signedProductImage(product.id, product.image_path) })));
  const status = params.status === "created" ? "Produto criado com sucesso." : params.status === "updated" ? "Produto atualizado com sucesso." : null;
  const categoryNames = new Map(options.categories.map((o) => [o.id, o.label]));
  const sectorNames = new Map(options.sectors.map((o) => [o.id, o.label]));
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold tracking-[.2em] text-muted-foreground">CADASTROS / ALMOXARIFADO</p><h1 className="display-heading mt-3 text-5xl">Produtos</h1><p className="mt-3 text-sm text-muted-foreground">Consulte o estoque e mantenha os dados dos produtos.</p></div>{permissions.canManage && <Button asChild><Link href="/products/new">+ Novo produto</Link></Button>}</div>
    {status && <p role="status" className="mt-6 rounded-md border border-border bg-muted p-4 text-sm">{status}</p>}
    <form action="/products" method="get" role="search" className="my-8 grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><label htmlFor="product-search" className="text-sm font-semibold">Buscar por nome</label><Input id="product-search" name="q" defaultValue={query} placeholder="Nome do produto" /></div><div className="space-y-2"><label htmlFor="category-filter" className="text-sm font-semibold">Categoria</label><RelationSelect id="category-filter" name="category" defaultValue={category} options={options.categories} /></div><div className="space-y-2"><label htmlFor="sector-filter" className="text-sm font-semibold">Setor</label><RelationSelect id="sector-filter" name="sector" defaultValue={sector} options={options.sectors} /></div><div className="flex items-center gap-3"><Button type="submit">Filtrar</Button>{(query || category || sector) && <Link href="/products" className="text-sm underline">Limpar</Link>}</div></form>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><Table><TableHeader><TableRow><TableHead scope="col">FOTO</TableHead><TableHead scope="col">PRODUTO</TableHead><TableHead scope="col">ESTOQUE</TableHead><TableHead scope="col">PREÇO</TableHead><TableHead scope="col">CATEGORIA</TableHead><TableHead scope="col">SETOR</TableHead><TableHead scope="col" className="text-right">AÇÕES</TableHead></TableRow></TableHeader><TableBody>{products.length === 0 ? <TableRow><TableCell colSpan={7} className="py-16 text-center text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow> : products.map((product) => <TableRow key={product.id}><TableCell>{product.imageUrl ? <Image src={product.imageUrl} alt={`Foto de ${product.name}`} width={56} height={56} unoptimized className="h-14 w-14 rounded-md object-cover" /> : <span className="text-xs text-muted-foreground">{product.image_path ? "Foto indisponível" : "Sem foto"}</span>}</TableCell><TableCell className="max-w-xs break-words font-semibold">{product.name}{product.is_consumable && <span className="mt-1 block text-xs font-normal text-muted-foreground">Consumível · sem devolução</span>}</TableCell><TableCell>{product.qtd}</TableCell><TableCell className="whitespace-nowrap">{product.price === null ? "—" : money.format(product.price)}</TableCell><TableCell>{product.category_id ? categoryNames.get(product.category_id) ?? "Indisponível" : "—"}</TableCell><TableCell>{product.sector_id ? sectorNames.get(product.sector_id) ?? "Indisponível" : "—"}</TableCell><TableCell><div className="flex flex-wrap justify-end gap-2">{permissions.canManage && <StockEntry productId={product.id} name={product.name} />}{canLend && <NewLoan initialResource={{ id: product.id, name: product.name, qtd: product.qtd, is_consumable: product.is_consumable }} triggerLabel="Realizar Empréstimo" triggerClassName="bg-blue-700 text-white hover:bg-blue-800" />}{permissions.canManage && <Button asChild variant="outline" size="sm"><Link href={`/products/${product.id}/edit`} aria-label={`Editar ${product.name}`}>Editar</Link></Button>}{permissions.canDelete && <ProductDelete id={product.id} name={product.name} />}{!permissions.canManage && <span className="text-xs text-muted-foreground">Somente leitura</span>}</div></TableCell></TableRow>)}</TableBody></Table><div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4"><p className="text-xs text-muted-foreground">{count === 0 ? "0 produtos" : `${from + 1}–${Math.min(from + products.length, count)} de ${count} produtos`}</p><nav aria-label="Paginação de produtos" className="flex items-center gap-3">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={productListUrl(page - 1, query, category, sector)} rel="prev">Anterior</Link></Button> : <Button variant="outline" size="sm" disabled>Anterior</Button>}<span className="text-xs">Página {page} de {pages}</span>{page < pages ? <Button asChild variant="outline" size="sm"><Link href={productListUrl(page + 1, query, category, sector)} rel="next">Próxima</Link></Button> : <Button variant="outline" size="sm" disabled>Próxima</Button>}</nav></div></div>
  </>;
}
export async function ProductNewPage() {
  if (!productPermissions(await requireProfile()).canManage) return <ProductDenied />;
  const options = await loadProductOptions();
  return <><Link href="/products" className="text-sm underline">← Produtos</Link><h1 className="display-heading mt-6 text-4xl">Novo produto</h1><p className="mt-3 text-sm text-muted-foreground">Informe os dados e a quantidade inicial do produto.</p><ProductForm options={options} /></>;
}
export async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!productPermissions(await requireProfile()).canManage) return <ProductDenied />;
  const id = productIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const client = await createClient();
  const [{ data, error }, options] = await Promise.all([client.from("products").select(PRODUCT_COLUMNS).eq("id", id.data).maybeSingle(), loadProductOptions()]);
  if (error) throw new Error("Não foi possível consultar o produto.");
  if (!data) notFound();
  const product = data as ProductRecord;
  const imageUrl = await signedProductImage(product.id, product.image_path);
  return <><Link href="/products" className="text-sm underline">← Produtos</Link><h1 className="display-heading mt-6 text-4xl">Editar produto</h1><p className="mt-3 text-sm text-muted-foreground">Atualize o cadastro. O estoque não pode ser alterado nesta tela.</p>{imageUrl && <Image src={imageUrl} alt={`Foto atual de ${product.name}`} width={160} height={160} unoptimized className="mt-6 h-40 w-40 rounded-lg object-cover" />}<ProductForm key={product.id} product={product} options={options} /></>;
}
