import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function signedProfilePhoto(id: string, path: string | null) {
  if (!path || !path.startsWith(`${id}/`)) return null;
  const client = await createClient();
  const { data, error } = await client.storage.from("profile-images").createSignedUrl(path, 300);
  return error ? null : data.signedUrl;
}