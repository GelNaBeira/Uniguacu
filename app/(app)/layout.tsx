import { requireProfile } from "@/lib/auth/session";
import { AppNavigation, Breadcrumb } from "@/components/app-navigation";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <div className="min-h-screen"><AppNavigation name={profile.name} role={profile.role} />
    <main id="main" className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-10"><div className="mb-7"><Breadcrumb /></div>{children}</main>
  </div>;
}