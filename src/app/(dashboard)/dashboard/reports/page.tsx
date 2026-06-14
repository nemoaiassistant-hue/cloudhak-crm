import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsView } from "@/components/reports/reports-view";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id")
    .eq("user_id", user.id);

  const subaccountId = roles?.[0]?.subaccount_id;

  if (!subaccountId) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Reports & Analytics</h1>
      <ReportsView subaccountId={subaccountId} />
    </div>
  );
}
