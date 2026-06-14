import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgencyOverview } from "@/components/agency/agency-overview";
import { Building2 } from "lucide-react";

export default async function AgencyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get user's org via their first sub-account role
  const { data: roleData } = await supabase
    .from("user_subaccount_roles")
    .select("role, subaccount_id, sub_accounts(org_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!roleData) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Agency Overview</h1>
        </div>
        <p className="text-muted-foreground">No organization found. Please contact support.</p>
      </div>
    );
  }

  const sa = roleData.sub_accounts as unknown as { org_id: string };
  const orgId = sa?.org_id;
  const role = roleData.role as string;

  // Only admins can see agency view
  if (role !== "admin") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Agency Overview</h1>
        </div>
        <p className="text-muted-foreground">You need admin access to view the agency dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Agency Overview</h1>
          </div>
          <p className="text-sm text-muted-foreground">Cross-account view of all client workspaces</p>
        </div>
      </div>
      {orgId && <AgencyOverview orgId={orgId} />}
    </div>
  );
}
