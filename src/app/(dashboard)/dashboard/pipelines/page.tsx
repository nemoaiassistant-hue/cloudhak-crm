import { createClient } from "@/lib/supabase/server";
import { PipelineList } from "@/components/pipelines/pipeline-list";
import { redirect } from "next/navigation";

export default async function PipelinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id")
    .eq("user_id", user.id);

  const subaccountIds = (roles || []).map(
    (r: { subaccount_id: string }) => r.subaccount_id
  );

  if (subaccountIds.length === 0) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Pipelines</h1>
        <p className="text-muted-foreground">You need a workspace first. Sign up to create one.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Pipelines</h1>
      <PipelineList subaccountId={subaccountIds[0]} />
    </div>
  );
}
