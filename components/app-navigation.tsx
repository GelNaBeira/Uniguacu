"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import { canViewAdministration, isNavigationActive, navigationGroups } from "@/lib/navigation";
const links = [
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
export function AppNavigation({ role }: { role: "ADMIN" | "USER" }) {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  return <Sidebar>
    <SidebarHeader><p className="text-xs tracking-[.2em] text-[#d4bd81]">UNIGUAÇU</p><p className="display-heading mt-2 text-3xl">Almoxarifado.</p><p className="mt-2 text-xs text-white/55">Foz do Iguaçu</p></SidebarHeader>
    <SidebarContent><nav aria-label="Navegação principal"><SidebarMenu>
      <SidebarMenuItem><SidebarMenuButton asChild isActive={path === "/home"}><Link href="/home" aria-current={path === "/home" ? "page" : undefined} onClick={() => setOpenMobile(false)}><span className="font-mono text-xs text-[#d4bd81]">01</span>Início</Link></SidebarMenuButton></SidebarMenuItem>
      {navigationGroups.map((group) => {
        const active = group.items.some((item) => isNavigationActive(path, item.href));
        return <Collapsible key={`${group.label}-${path}`} asChild defaultOpen={active} className="group/collapsible">
          <SidebarMenuItem><CollapsibleTrigger asChild><SidebarMenuButton isActive={active}><span className="font-mono text-xs text-[#d4bd81]">{group.number}</span>{group.label}<span aria-hidden="true" className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180">⌄</span></SidebarMenuButton></CollapsibleTrigger>
            <CollapsibleContent><SidebarMenuSub>{group.items.map((item) => {
              const itemActive = isNavigationActive(path, item.href);
              return <SidebarMenuSubItem key={item.href}><SidebarMenuSubButton asChild isActive={itemActive}><Link href={item.href} aria-current={itemActive ? "page" : undefined} onClick={() => setOpenMobile(false)}>{item.label}</Link></SidebarMenuSubButton></SidebarMenuSubItem>;
            })}</SidebarMenuSub></CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>;
      })}
      {canViewAdministration(role) && <Collapsible asChild className="group/collapsible"><SidebarMenuItem>
        <CollapsibleTrigger asChild><SidebarMenuButton><span className="font-mono text-xs text-[#d4bd81]">05</span>Administração<span aria-hidden="true" className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180">⌄</span></SidebarMenuButton></CollapsibleTrigger>
        <CollapsibleContent><SidebarMenuSub><SidebarMenuSubItem><span aria-disabled="true" className="flex min-h-10 items-center justify-between gap-2 px-3 py-2 text-sm text-white/45">Usuários<span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px]">Em breve</span></span></SidebarMenuSubItem></SidebarMenuSub></CollapsibleContent>
      </SidebarMenuItem></Collapsible>}
    </SidebarMenu></nav></SidebarContent>
    <SidebarFooter><p className="text-xs leading-6 text-white/55">Gestão de materiais<br />e recursos institucionais.</p></SidebarFooter>
  </Sidebar>;
}
export function Breadcrumb() {
  const path = usePathname();
  const current = links.find((link) => link.href === path || path.startsWith(`${link.href}/`));
  const detail = path.endsWith("/new") ? current?.newTitle : path.endsWith("/edit") ? current?.editTitle : null;
  return <nav aria-label="Localização" className="text-sm text-muted-foreground"><Link href="/home">Almoxarifado</Link><span aria-hidden="true" className="mx-3">/</span>{detail && current ? <><Link href={current.href}>{current.label}</Link><span aria-hidden="true" className="mx-3">/</span></> : null}<span aria-current="page" className="text-foreground">{detail ?? current?.label ?? "Página"}</span></nav>;
}