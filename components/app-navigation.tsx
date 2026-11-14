"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { logout } from "@/app/(auth)/actions";
import { isNavigationActive } from "@/lib/navigation";

const mainLinks = [
  { href: "/home", label: "Home", icon: "⌂" },
  { href: "/products", label: "Produtos", icon: "▣" },
  { href: "/keys", label: "Chaves", icon: "⚿" },
  { href: "/collaborators", label: "Colaboradores", icon: "♙" },
  { href: "/academics", label: "Acadêmicos", icon: "◇" },
];
export function AppNavigation({ name, role }: { name: string; role: "ADMIN" | "USER" }) {
  const path = usePathname();
  return <header className="border-b border-border bg-card shadow-sm">
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-8">
      <Link href="/home" aria-label="Uniguacu — início"><Image src="/images/logo-uniguacu.png" alt="Uniguacu" width={156} height={56} priority className="h-12 w-36 object-contain" /></Link>
      <nav aria-label="Navegação principal" className="order-3 flex w-full flex-wrap items-center justify-center gap-1 border-t border-border pt-3 xl:order-none xl:w-auto xl:border-0 xl:pt-0">
        {mainLinks.map((link) => <Link key={link.href} href={link.href} aria-current={isNavigationActive(path, link.href) ? "page" : undefined} className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${isNavigationActive(path, link.href) ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span aria-hidden="true" className="text-lg">{link.icon}</span>{link.label}</Link>)}
        <details className="relative"><summary className="cursor-pointer rounded-md px-3 py-3 text-sm font-semibold text-muted-foreground">Cadastros</summary><div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-border bg-card p-2 shadow-xl">{[{ href: "/cars", label: "Carros" }, { href: "/categories", label: "Categorias" }, { href: "/sectors", label: "Setores" }, { href: "/suppliers", label: "Fornecedores" }, { href: "/product-codes", label: "Códigos de produtos" }].map((link) => <Link key={link.href} href={link.href} className="block rounded px-3 py-2 text-sm hover:bg-muted">{link.label}</Link>)}</div></details>
      </nav>
      <details className="relative"><summary aria-label={`Menu de ${name}`} className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-2 hover:bg-muted"><span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><span className="max-w-28 truncate text-sm font-semibold sm:max-w-40">{name}</span><span aria-hidden="true">⌄</span></summary><div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-xl"><p className="border-b border-border px-2 pb-3 text-xs text-muted-foreground">{role === "ADMIN" ? "Administrador" : "Usuário"}</p><Link href="/profile" className="mt-1 block rounded px-2 py-2 text-sm hover:bg-muted">Perfil</Link><Link href="/help" className="block rounded px-2 py-2 text-sm hover:bg-muted">Ajuda</Link><form action={logout}><button className="mt-1 w-full rounded px-2 py-2 text-left text-sm font-semibold text-red-800 hover:bg-red-50">Sair</button></form></div></details>
    </div>
  </header>;
}
const links = [
  { href: "/profile", label: "Meu perfil", number: "", newTitle: "", editTitle: "" },
  { href: "/help", label: "Ajuda", number: "", newTitle: "", editTitle: "" },
  { href: "/home", label: "Início", number: "01", newTitle: "", editTitle: "" },
  { href: "/categories", label: "Categorias", number: "02", newTitle: "Nova categoria", editTitle: "Editar categoria" },
  { href: "/sectors", label: "Setores", number: "03", newTitle: "Novo setor", editTitle: "Editar setor" },
  { href: "/suppliers", label: "Fornecedores", number: "04", newTitle: "Novo fornecedor", editTitle: "Editar fornecedor" },
  { href: "/collaborators", label: "Colaboradores", number: "05", newTitle: "Novo colaborador", editTitle: "Editar colaborador" },
  { href: "/academics", label: "Acadêmicos", number: "06", newTitle: "Novo acadêmico", editTitle: "Editar acadêmico" },
  { href: "/products", label: "Produtos", number: "07", newTitle: "Novo produto", editTitle: "Editar produto" },
  { href: "/product-codes", label: "Códigos de produtos", number: "08", newTitle: "", editTitle: "" },
  { href: "/keys", label: "Chaves", number: "09", newTitle: "Nova chave", editTitle: "Editar chave" },
  { href: "/cars", label: "Carros", number: "10", newTitle: "Novo carro", editTitle: "Editar carro" },
];
export function Breadcrumb() {
  const path = usePathname();
  const current = links.find((link) => link.href === path || path.startsWith(`${link.href}/`));
  const detail = path.endsWith("/new") ? current?.newTitle : path.endsWith("/edit") ? current?.editTitle : null;
  return <nav aria-label="Localização" className="text-sm text-muted-foreground"><Link href="/home">Almoxarifado</Link><span aria-hidden="true" className="mx-3">/</span>{detail && current ? <><Link href={current.href}>{current.label}</Link><span aria-hidden="true" className="mx-3">/</span></> : null}<span aria-current="page" className="text-foreground">{detail ?? current?.label ?? "Página"}</span></nav>;
}
