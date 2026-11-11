"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProduct, updateProduct } from "@/app/(app)/products/actions";
import { productCreateSchema, productEditSchema, type ProductEditValues, type ProductCreateValues, type ProductRecord } from "@/lib/products/schema";
import { IMAGE_ACCEPT, imageMetadataError } from "@/lib/products/image-validation";
import type { ProductOptions } from "@/lib/products/options";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RelationSelect } from "./relation-select";

export function ProductForm({ product, options }: { product?: ProductRecord; options: ProductOptions }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [saved, setSaved] = useState<{ id: string; warning: string } | null>(null);
  type Values = ProductEditValues & { qtd?: number };
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(product ? productEditSchema : productCreateSchema),
    defaultValues: {
      name: product?.name ?? "", price: product?.price == null ? "" : String(product.price),
      bar_code: product?.bar_code ?? "", note_id: product?.note_id ?? "", description: product?.description ?? "",
      has_barcode: product?.has_barcode ?? false, category_id: product?.category_id ?? "",
      sector_id: product?.sector_id ?? "", supplier_id: product?.supplier_id ?? "", ...(!product ? { qtd: 0 } : {}),
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    if (photo) { const error = imageMetadataError(photo.size, photo.type); if (error) { setError("root", { message: error }); return; } }
    const form = new FormData(); if (photo) form.set("photo", photo);
    try {
      const result = product ? await updateProduct(product.id, values, form) : await createProduct(values as ProductCreateValues, form);
      if (!result.success) { setError("root", { message: result.message }); return; }
      if (result.warning) { setSaved({ id: result.id, warning: result.warning }); return; }
      router.push(`/products?status=${product ? "updated" : "created"}`); router.refresh();
    } catch { setError("root", { message: "Não foi possível concluir. Verifique sua conexão e consulte a listagem antes de repetir o cadastro." }); }
  });
  if (saved) return <Card className="mt-8 max-w-2xl"><h2 className="display-heading text-3xl">Produto salvo</h2><p role="status" className="my-5 text-sm leading-6">{saved.warning}</p><div className="flex flex-wrap gap-3"><Button asChild><Link href={`/products/${saved.id}/edit`} onClick={() => { setSaved(null); setPhoto(null); router.refresh(); }}>Abrir edição</Link></Button><Button asChild variant="outline"><Link href="/products">Voltar à listagem</Link></Button></div></Card>;
  const errorText = (name: keyof Values) => errors[name] ? <p id={`product-${name}-error`} role="alert" className="text-sm text-red-800">{errors[name]?.message}</p> : null;
  return <Card className="mt-8 max-w-3xl p-6 sm:p-8"><form onSubmit={onSubmit} noValidate className="space-y-6">
    <div className="space-y-2"><label htmlFor="product-name" className="text-sm font-semibold">Nome (obrigatório)</label><Input id="product-name" autoFocus disabled={isSubmitting} aria-invalid={!!errors.name} aria-describedby={errors.name ? "product-name-error" : undefined} {...register("name")} />{errorText("name")}</div>
    <div className="grid gap-6 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="product-qtd" className="text-sm font-semibold">{product ? "Quantidade em estoque" : "Quantidade inicial (obrigatório)"}</label>{product ? <><Input id="product-qtd" type="number" value={product.qtd} disabled aria-describedby="product-qtd-help" /><p id="product-qtd-help" className="text-xs leading-5 text-muted-foreground">A quantidade em estoque só pode ser alterada através de movimentações</p></> : <><Input id="product-qtd" type="number" min={0} step={1} disabled={isSubmitting} aria-invalid={!!errors.qtd} aria-describedby={errors.qtd ? "product-qtd-error" : undefined} {...register("qtd", { valueAsNumber: true })} />{errorText("qtd")}</>}</div>
      <div className="space-y-2"><label htmlFor="product-price" className="text-sm font-semibold">Preço unitário (opcional)</label><Input id="product-price" inputMode="decimal" placeholder="0,00" disabled={isSubmitting} aria-invalid={!!errors.price} aria-describedby={errors.price ? "product-price-error" : undefined} {...register("price")} />{errorText("price")}</div></div>
    <div className="grid gap-6 sm:grid-cols-2">{([{ name: "category_id", label: "Categoria", options: options.categories }, { name: "sector_id", label: "Setor", options: options.sectors }, { name: "supplier_id", label: "Fornecedor", options: options.suppliers }] as const).map((field) => <div key={field.name} className="space-y-2"><label htmlFor={`product-${field.name}`} className="text-sm font-semibold">{field.label} (opcional)</label><RelationSelect id={`product-${field.name}`} options={field.options} disabled={isSubmitting} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `product-${field.name}-error` : undefined} {...register(field.name)} />{errorText(field.name)}</div>)}</div>
    <div className="space-y-2"><label htmlFor="product-note_id" className="text-sm font-semibold">Identificação da nota (opcional)</label><Input id="product-note_id" disabled={isSubmitting} {...register("note_id")} /></div>
    <div className="space-y-2"><label htmlFor="product-description" className="text-sm font-semibold">Descrição (opcional)</label><textarea id="product-description" rows={4} className="w-full rounded-md border border-input bg-background p-3 focus-visible:outline-ring" disabled={isSubmitting} {...register("description")} /></div>
    <fieldset className="space-y-4 rounded-md border border-border p-4"><legend className="px-2 text-sm font-semibold">Código de barras manual</legend><label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={isSubmitting} {...register("has_barcode")} />Produto possui código de barras</label><div className="space-y-2"><label htmlFor="product-bar_code" className="text-sm font-semibold">Código (texto, opcional)</label><Input id="product-bar_code" disabled={isSubmitting} {...register("bar_code")} /></div><p className="text-xs text-muted-foreground">Sem geração, leitura ou controle de códigos individuais por exemplar no MVP.</p></fieldset>
    <div className="space-y-2"><label htmlFor="product-photo" className="text-sm font-semibold">Foto do produto (opcional)</label><Input id="product-photo" type="file" accept={IMAGE_ACCEPT} disabled={isSubmitting} aria-describedby="product-photo-help" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /><p id="product-photo-help" className="text-xs leading-5 text-muted-foreground">JPEG, PNG ou WebP, até 3 MB. A foto é armazenada em bucket privado.{product?.image_path ? " Selecione um arquivo apenas se desejar substituir a foto atual." : ""}</p></div>
    {errors.root && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
    <div className="flex flex-wrap gap-3 border-t border-border pt-6"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar produto"}</Button><Button asChild variant="outline"><Link href="/products">Cancelar</Link></Button></div>
  </form></Card>;
}