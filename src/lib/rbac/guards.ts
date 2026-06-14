import { createClient } from "@/lib/supabase/server";
import { hasPermission, type Role, type Permission } from "./permissions";
import { redirect } from "next/navigation";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  subaccountId: string;
}

/**
 * Get the current authenticated user + their role for a sub-account.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get the user's first role (active sub-account)
  const { data: roleData } = await supabase
    .from("user_subaccount_roles")
    .select("role, subaccount_id, users(email)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!roleData) return null;

  const usersData = roleData.users as unknown as { email: string } | { email: string }[] | null;
  const email = Array.isArray(usersData)
    ? usersData[0]?.email || user.email || ""
    : usersData?.email || user.email || "";

  return {
    id: user.id,
    email,
    role: roleData.role as Role,
    subaccountId: roleData.subaccount_id,
  };
}

/**
 * Server-side guard: redirects to dashboard if user lacks permission.
 * Use in server components / pages.
 */
export async function requirePermission(
  permission: Permission,
  redirectTo = "/dashboard"
): Promise<AuthUser> {
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect("/login");
  }

  if (!hasPermission(authUser.role, permission)) {
    redirect(redirectTo);
  }

  return authUser;
}

/**
 * Server-side check without redirect.
 * Returns { allowed, user }
 */
export async function checkPermission(
  permission: Permission
): Promise<{ allowed: boolean; user: AuthUser | null }> {
  const authUser = await getAuthUser();

  if (!authUser) {
    return { allowed: false, user: null };
  }

  return {
    allowed: hasPermission(authUser.role, permission),
    user: authUser,
  };
}

/**
 * API route guard: returns 403 JSON if unauthorized.
 */
export async function apiRequirePermission(permission: Permission): Promise<{
  allowed: boolean;
  user: AuthUser | null;
  error?: { status: number; message: string };
}> {
  const authUser = await getAuthUser();

  if (!authUser) {
    return {
      allowed: false,
      user: null,
      error: { status: 401, message: "Unauthorized" },
    };
  }

  if (!hasPermission(authUser.role, permission)) {
    return {
      allowed: false,
      user: authUser,
      error: { status: 403, message: "Insufficient permissions" },
    };
  }

  return { allowed: true, user: authUser };
}
