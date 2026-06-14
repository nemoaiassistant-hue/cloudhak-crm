import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgencyReports } from "@/components/agency/agency-reports";
import { TrendingUp } from "lucide-react";

export default async function AgencyReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleData } = await supabase
    .from("user_subaccount_roles")
    .select("role, sub_accounts(org_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!roleData) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Agency Reports</h1>
        <p className="text-muted-foreground">No organization found.</p>
      </div>
    );
  }

  const sa = roleData.sub_accounts as unknown as { org_id: string };
  const orgId = sa?.org_id;
  const role = roleData.role as string;

  if (role !== "admin") {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Agency Reports</h1>
        <p className="text-muted-foreground">You need admin access to view agency reports.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Agency Reports</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Cross-account analytics across all client workspaces</p>
      {orgId && <AgencyReports orgId={orgId} />}
    </div>
  );
}
