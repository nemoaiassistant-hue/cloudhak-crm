import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GHLMigration } from "@/components/migration/ghl-migration";

export default async function MigratePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id")
    .eq("user_id", user.id);

  const ids = (roles || []).map((r: { subaccount_id: string }) => r.subaccount_id);
  if (ids.length === 0) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Data Migration</h1>
        <p className="text-muted-foreground">You need a workspace first.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Data Migration</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Import your existing data from GoHighLevel into CloudHak CRM.
      </p>
      <GHLMigration subaccountId={ids[0]} />
    </div>
  );
}
