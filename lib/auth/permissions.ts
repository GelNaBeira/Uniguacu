export const permissionFlags = [
  "can_read_inventory", "can_manage_catalogs", "can_manage_products", "can_manage_keys",
  "can_manage_cars", "can_lend", "can_return", "can_delete", "can_view_reports", "can_view_all_lends",
] as const;

export type PermissionProfile = { role: string; is_active: boolean; limited_access: unknown };

export function hasPermission(profile: PermissionProfile, flag: typeof permissionFlags[number]): boolean {
  if (!profile.is_active || profile.role !== "USER") return false;
  const access = profile.limited_access;
  if (!access || typeof access !== "object" || Array.isArray(access)) return false;
  const flags = access as Record<string, unknown>;
  if (flags.version !== 1) return false;
  if (Object.entries(flags).some(([key, value]) => key !== "version" &&
    (!permissionFlags.includes(key as typeof permissionFlags[number]) || typeof value !== "boolean"))) return false;
  return flags[flag] === true;
}

export function catalogPermissions(profile: PermissionProfile) {
  const admin = profile.is_active && profile.role === "ADMIN";
  const canRead = admin || hasPermission(profile, "can_read_inventory");
  const canManage = admin || (canRead && hasPermission(profile, "can_manage_catalogs"));
  return { canRead, canManage, canDelete: admin || (canManage && hasPermission(profile, "can_delete")) };
}

export function productPermissions(profile: PermissionProfile) {
  const admin = profile.is_active && profile.role === "ADMIN";
  const canRead = admin || hasPermission(profile, "can_read_inventory");
  const canManage = admin || (canRead && hasPermission(profile, "can_manage_products"));
  return { canRead, canManage, canDelete: admin || (canManage && hasPermission(profile, "can_delete")) };
}

export function resourcePermissions(profile: PermissionProfile, entity: "keys" | "cars") {
  const admin = profile.is_active && profile.role === "ADMIN";
  const canRead = admin || hasPermission(profile, "can_read_inventory");
  const canManage = admin || (canRead && hasPermission(profile, entity === "keys" ? "can_manage_keys" : "can_manage_cars"));
  return { canRead, canManage, canDelete: admin || (canManage && hasPermission(profile, "can_delete")), canCorrectMileage: admin && entity === "cars" };
}

export function lendingPermissions(profile: PermissionProfile) {
  const admin = profile.is_active && profile.role === "ADMIN";
  const canRead = admin || hasPermission(profile, "can_read_inventory");
  return {
    canRead,
    canLend: admin || (canRead && hasPermission(profile, "can_lend")),
    canReturn: admin || (canRead && hasPermission(profile, "can_return")),
    canViewAll: admin || (canRead && hasPermission(profile, "can_view_all_lends")),
  };
}