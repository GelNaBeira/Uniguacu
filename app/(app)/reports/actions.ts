"use server";
import { requireProfile } from "@/lib/auth/session";
import { executeReport } from "@/lib/reports/service";
import { loadReport } from "@/lib/reports/queries";
import { renderReport } from "@/lib/reports/render";
import { enforceRateLimit } from "@/lib/security/server-rate-limit";

export async function generateReport(input: unknown) {
  const profile = await requireProfile();
  const limit = await enforceRateLimit("reports");
  if (!limit.allowed) return { success: false as const, message: limit.message };
  return executeReport(profile, input, { load: loadReport, render: renderReport });
}