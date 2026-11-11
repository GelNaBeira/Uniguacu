"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [
  { href: "/home", label: "Início", number: "01", newTitle: "", editTitle: "" },
  { href: "/categories", label: "Categorias", number: "02", newTitle: "Nova categoria", editTitle: "Editar categoria" },
  { href: "/sectors", label: "Setores", number: "03", newTitle: "Novo setor", editTitle: "Editar setor" },
  { href: "/suppliers", label: "Fornecedores", number: "04", newTitle: "Novo fornecedor", editTitle: "Editar fornecedor" },
  { href: "/collaborators", label: "Colaboradores", number: "05", newTitle: "Novo colaborador", editTitle: "Editar colaborador" },
  { href: "/academics", label: "Acadêmicos", number: "06", newTitle: "Novo acadêmico", editTitle: "Editar acadêmico" },
  { href: "/product-codes", label: "Códigos de produtos", number: "07", newTitle: "", editTitle: "" },
];
export function AppNavigation() {
  const path = usePathname();
  return <nav aria-label="Navegação principal" className="space-y-2">{links.map((link) => { const active = path === link.href || path.startsWith(`${link.href}/`); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm ${active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`}><span className="font-mono text-xs text-[#d4bd81]">{link.number}</span>{link.label}</Link>; })}</nav>;
}
export function Breadcrumb() {
  const path = usePathname();
  const current = links.find((link) => link.href === path || path.startsWith(`${link.href}/`));
  const detail = path.endsWith("/new") ? current?.newTitle : path.endsWith("/edit") ? current?.editTitle : null;
  return <nav aria-label="Localização" className="text-sm text-muted-foreground"><Link href="/home">Almoxarifado</Link><span aria-hidden="true" className="mx-3">/</span>{detail && current ? <><Link href={current.href}>{current.label}</Link><span aria-hidden="true" className="mx-3">/</span></> : null}<span aria-current="page" className="text-foreground">{detail ?? current?.label ?? "Página"}</span></nav>;
}