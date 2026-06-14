"use client";

import { useRBAC } from "@/lib/rbac/use-rbac";
import type { Permission } from "@/lib/rbac/permissions";

interface PermissionGateProps {
  subaccountId: string | null | undefined;
  /** Require ALL of these permissions */
  require?: Permission | Permission[];
  /** Require ANY of these permissions */
  requireAny?: Permission[];
  /** Fallback to show if permission denied */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 *
 * @example
 * <PermissionGate subaccountId={sa} require="contacts.delete">
 *   <DeleteButton />
 * </PermissionGate>
 */
export function PermissionGate({
  subaccountId,
  require,
  requireAny,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, loading } = useRBAC(subaccountId);

  if (loading) return null; // or a spinner

  if (require) {
    const perms = Array.isArray(require) ? require : [require];
    const hasAll = perms.every((p) => can(p));
    if (!hasAll) return <>{fallback}</>;
  }

  if (requireAny && !canAny(requireAny)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
