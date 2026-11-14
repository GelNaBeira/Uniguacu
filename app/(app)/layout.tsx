import { requireProfile } from "@/lib/auth/session";
import { AppNavigation, Breadcrumb } from "@/components/app-navigation";
import { signedProfilePhoto } from "@/lib/users/photos";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const photo = await signedProfilePhoto(profile.id, profile.photo_url);
  return <div className="min-h-screen"><AppNavigation name={profile.name} role={profile.role} photo={photo} />
    <main id="main" className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-10"><div className="mb-7"><Breadcrumb /></div>{children}</main>
  </div>;
}