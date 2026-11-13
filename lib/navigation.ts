export const navigationGroups = [
  { label: "Produtos", number: "02", items: [
    { href: "/products", label: "Lista" },
    { href: "/categories", label: "Categorias" },
    { href: "/sectors", label: "Setores" },
    { href: "/suppliers", label: "Fornecedores" },
  ] },
  { label: "Pessoas", number: "03", items: [
    { href: "/collaborators", label: "Colaboradores" },
    { href: "/academics", label: "Acadêmicos" },
  ] },
  { label: "Patrimônio", number: "04", items: [
    { href: "/keys", label: "Chaves" },
    { href: "/cars", label: "Carros" },
  ] },
];

export function isNavigationActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function canViewAdministration(role: string) {
  return role === "ADMIN";
}