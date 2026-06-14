import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check if user already has org/sub-account set up
  const { data: existingRole } = await supabase
    .from("user_subaccount_roles")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (existingRole) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // User is authenticated but has no org — create it now
  const orgName = (user.user_metadata?.full_name as string)
    ? `${user.user_metadata.full_name}'s Organization`
    : "My Organization";
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Create organization
  const { data: orgData, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: orgName, slug, plan_tier: "free" })
    .select("id")
    .single();

  if (orgError || !orgData) {
    console.error("Org creation failed in onboarding:", orgError);
    return NextResponse.redirect(new URL("/dashboard?error=org_setup_failed", req.url));
  }

  // Create default sub-account
  const { data: saData, error: saError } = await supabase
    .from("sub_accounts")
    .insert({ org_id: orgData.id, name: orgName, slug })
    .select("id")
    .single();

  if (saError || !saData) {
    console.error("Sub-account creation failed in onboarding:", saError);
    return NextResponse.redirect(new URL("/dashboard?error=sa_setup_failed", req.url));
  }

  // Assign user as admin
  const { error: roleError } = await supabase
    .from("user_subaccount_roles")
    .insert({
      user_id: user.id,
      subaccount_id: saData.id,
      role: "admin",
    });

  if (roleError) {
    console.error("Role assignment failed in onboarding:", roleError);
  }

  return NextResponse.redirect(new URL("/dashboard?welcome=true", req.url));
}
