import { requireProfile } from "@/lib/auth/session";
import { logout } from "@/app/(auth)/actions";
import { AppNavigation, Breadcrumb } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
    <aside className="hidden flex-col bg-primary px-5 py-9 text-white lg:flex"><div className="px-4 pb-12"><p className="text-xs tracking-[.2em] text-[#d4bd81]">UNIGUAÇU</p><p className="display-heading mt-2 text-3xl">Almoxarifado.</p><p className="mt-2 text-xs text-white/50">Foz do Iguaçu</p></div><AppNavigation /><p className="mt-auto px-4 pt-12 text-xs leading-6 text-white/50">Gestão de materiais<br />e recursos institucionais.</p></aside>
    <div className="min-w-0"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5 lg:px-10"><Breadcrumb /><div className="flex items-center gap-5"><div className="text-right"><p className="text-sm font-semibold">{profile.name}</p><p className="text-xs text-muted-foreground">{profile.role === "ADMIN" ? "Administrador" : "Usuário"}</p></div><form action={logout}><Button variant="outline" size="sm">Sair</Button></form></div></header>
      <details className="border-b border-border bg-primary p-4 text-white lg:hidden"><summary className="cursor-pointer text-sm font-semibold">Menu do almoxarifado</summary><div className="mt-4"><AppNavigation /></div></details><main id="main" className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">{children}</main>
    </div></div>;
}