"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasPermission, hasAnyPermission, type Role, type Permission } from "./permissions";

interface UseRBACReturn {
  role: Role | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
}

export function useRBAC(subaccountId: string | null | undefined): UseRBACReturn {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!subaccountId) {
        setRole(null);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_subaccount_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("subaccount_id", subaccountId)
        .single();

      setRole((data?.role as Role) || null);
      setLoading(false);
    }
    fetchRole();
  }, [subaccountId]);

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role]
  );

  const canAny = useCallback(
    (permissions: Permission[]) => hasAnyPermission(role, permissions),
    [role]
  );

  return { role, loading, can, canAny };
}
