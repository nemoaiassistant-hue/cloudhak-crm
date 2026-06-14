import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientManager } from "@/components/agency/client-manager";
import { Building2 } from "lucide-react";

export default async function AgencyClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get user's org
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
        <h1 className="mb-6 text-2xl font-bold">Client Management</h1>
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
        <h1 className="mb-6 text-2xl font-bold">Client Management</h1>
        <p className="text-muted-foreground">You need admin access to manage clients.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Client Management</h1>
      </div>
      {orgId && <ClientManager orgId={orgId} currentUserId={user.id} />}
    </div>
  );
}
