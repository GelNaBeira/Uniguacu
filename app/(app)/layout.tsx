import { requireProfile } from "@/lib/auth/session";
import { logout } from "@/app/(auth)/actions";
import { AppNavigation, Breadcrumb } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <SidebarProvider>
    <AppNavigation role={profile.role} />
    <div className="min-w-0 flex-1"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-4 py-5 lg:px-10"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger /><Breadcrumb /></div><div className="ml-auto flex items-center gap-5"><div className="text-right"><p className="text-sm font-semibold">{profile.name}</p><p className="text-xs text-muted-foreground">{profile.role === "ADMIN" ? "Administrador" : "Usuário"}</p></div><form action={logout}><Button variant="outline" size="sm">Sair</Button></form></div></header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">{children}</main>
    </div></SidebarProvider>;
}