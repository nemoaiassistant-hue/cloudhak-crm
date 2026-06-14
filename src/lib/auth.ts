import { createClient } from "@/lib/supabase/server";

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface SubAccount {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  role: string;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function getSubAccounts(): Promise<SubAccount[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("user_subaccount_roles")
    .select(
      `
      subaccount_id,
      role,
      sub_accounts (
        id,
        org_id,
        name,
        slug
      )
    `
    )
    .eq("user_id", user.id);

  if (!data) return [];

  return data.map((item: Record<string, unknown>) => {
    const sa = item.sub_accounts as Record<string, unknown>;
    return {
      id: sa.id as string,
      org_id: sa.org_id as string,
      name: sa.name as string,
      slug: sa.slug as string,
      role: item.role as string,
    };
  });
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
