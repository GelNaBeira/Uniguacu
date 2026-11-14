import "server-only";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, type RateLimitScope } from "./rate-limit";

export async function enforceRateLimit(scope: RateLimitScope) {
  return checkRateLimit(scope, async (value) => {
    const client = await createClient();
    return client.rpc("consume_action_rate_limit", { p_scope: value });
  });
}