import { lendingPermissions, type PermissionProfile } from "../auth/permissions.ts";
import { lendSchema, returnSchema, uuidSchema, lendingError, type LendingResult } from "./schema.ts";

export type LendingRepository = { rpc: (name: string, args: Record<string, string | number | null>) => Promise<{ data: unknown; error: { code?: string } | null }> };
export async function executeLendingCommand(action: "lend" | "return", profile: PermissionProfile, repository: LendingRepository, input: unknown): Promise<LendingResult> {
  const permissions = lendingPermissions(profile);
  if (!(action === "lend" ? permissions.canLend : permissions.canReturn)) return { success: false, ...lendingError("42501") };
  const parsed = action === "lend" ? lendSchema.safeParse(input) : returnSchema.safeParse(input);
  if (!parsed.success) return { success: false, uncertain: false, message: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const value = parsed.data;
  let name: string;
  let args: Record<string, string | number | null>;
  if ("requestId" in value) {
    name = `lend_${value.kind}`;
    args = { p_collaborator_id: value.collaboratorId ?? null, p_academic_id: value.academicId ?? null, p_request_id: value.requestId };
    if (value.kind === "product") { args.p_product_id = value.resourceId; args.p_quantity = value.quantity; }
    else if (value.kind === "key") args.p_key_id = value.resourceId;
    else { args.p_car_id = value.resourceId; args.p_km_out = value.kmOut; }
  } else {
    name = `return_${value.kind}`;
    args = { p_lend_id: value.loanId };
    if (value.kind === "car") args.p_km_in = value.kmIn;
  }
  try {
    const result = await repository.rpc(name, args);
    if (result.error) return { success: false, ...lendingError(result.error.code) };
    const id = uuidSchema.safeParse(result.data);
    return id.success ? { success: true, id: id.data } : { success: false, ...lendingError() };
  } catch { return { success: false, ...lendingError() }; }
}