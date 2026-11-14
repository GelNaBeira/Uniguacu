import { requireProfile } from "@/lib/auth/session";
export default async function ProfilePage() {
  const profile = await requireProfile();
  return <section className="max-w-xl rounded-xl border border-border bg-card p-8"><h1 className="display-heading text-4xl">Meu perfil</h1><dl className="mt-6 space-y-4"><div><dt className="text-sm text-muted-foreground">Nome</dt><dd className="font-semibold">{profile.name}</dd></div><div><dt className="text-sm text-muted-foreground">Acesso</dt><dd>{profile.role === "ADMIN" ? "Administrador" : "Usuário"}</dd></div></dl><p className="mt-6 text-sm text-muted-foreground">Para alterar seus dados ou permissões, procure a administração do almoxarifado.</p></section>;
}