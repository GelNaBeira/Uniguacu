"use server";
import { requireProfile } from "@/lib/auth/session";
import { executeReport } from "@/lib/reports/service";
import { loadReport } from "@/lib/reports/queries";
import { renderReport } from "@/lib/reports/render";

export async function generateReport(input: unknown) {
  const profile = await requireProfile();
  return executeReport(profile, input, { load: loadReport, render: renderReport });
}