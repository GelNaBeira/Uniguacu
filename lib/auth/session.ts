import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { authDiagnostic } from "./diagnostics";

export async function requireProfile(diagnosticRequestId?: string) {
  if (!getPublicEnv()) redirect("/login?status=configuration");
  const supabase = await createClient(diagnosticRequestId);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (diagnosticRequestId) authDiagnostic("session.auth_user", {
    requestId: diagnosticRequestId, userId: user?.id ?? null, code: error?.code ?? null,
  });
  if (error || !user) {
    authDiagnostic("session.identity_failed", { code: error?.code ?? null });
    redirect("/login");
  }
  const { data: profile, error: profileError } = await supabase.from("usuarios").select("id,name,email,role,is_active,limited_access").eq("id", user.id).eq("is_active", true).maybeSingle();
  if (diagnosticRequestId) authDiagnostic("session.database_profile", {
    requestId: diagnosticRequestId, authUserId: user.id, profileId: profile?.id ?? null,
    role: profile?.role ?? null, isActive: profile?.is_active ?? null,
    code: profileError?.code ?? null, message: profileError?.message ?? null,
  });
  if (profileError || !profile) authDiagnostic("session.profile_failed", {
    userId: user.id, code: profileError?.code ?? null, message: profileError?.message ?? null,
  });
  if (!profile || !["ADMIN", "USER"].includes(profile.role)) redirect("/login?status=access");
  return profile as { id: string; name: string; email: string; role: "ADMIN" | "USER"; is_active: boolean; limited_access: unknown };
}