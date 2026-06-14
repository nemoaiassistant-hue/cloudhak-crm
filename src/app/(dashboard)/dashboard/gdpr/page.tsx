import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GDPRTools } from "@/components/gdpr/gdpr-tools";

export default async function GDPRPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id, role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  const subaccountId = roles?.[0]?.subaccount_id;

  if (!subaccountId) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">GDPR Compliance</h1>
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">GDPR Compliance</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Data subject rights management for UK data protection law.
      </p>
      <GDPRTools subaccountId={subaccountId} />
    </div>
  );
}
