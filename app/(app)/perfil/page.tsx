import { requireProfile } from "@/lib/auth/session";
import { signedProfilePhoto } from "@/lib/users/photos";
import { ProfileForm } from "@/components/users/profile-form";

export const metadata = { title: "Meu perfil" };
export default async function ProfilePage() {
  const profile = await requireProfile();
  const photo = await signedProfilePhoto(profile.id, profile.photo_url);
  return <section className="max-w-2xl rounded-xl border border-border bg-card p-6 sm:p-8"><h1 className="display-heading text-4xl">Meu perfil</h1><p className="mt-3 text-sm text-muted-foreground">Atualize seu nome e sua foto. Seu papel e suas permissões são definidos pela administração.</p><ProfileForm name={profile.name} email={profile.email} photo={photo} /></section>;
}