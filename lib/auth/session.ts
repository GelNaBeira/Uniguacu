import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";

export async function requireProfile() {
  if (!getPublicEnv()) redirect("/login?status=configuration");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile } = await supabase.from("usuarios").select("id,name,email,role,is_active,limited_access").eq("id", user.id).eq("is_active", true).maybeSingle();
  if (!profile || !["ADMIN", "USER"].includes(profile.role)) redirect("/login?status=access");
  return profile as { id: string; name: string; email: string; role: "ADMIN" | "USER"; is_active: boolean; limited_access: unknown };
}