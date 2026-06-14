import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GHLMigration } from "@/components/migration/ghl-migration";
import { CSVImport } from "@/components/migration/csv-import";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        Import contacts from GoHighLevel, a CSV file, or other sources.
      </p>
      <Tabs defaultValue="ghl">
        <TabsList className="mb-4">
          <TabsTrigger value="ghl">From GoHighLevel</TabsTrigger>
          <TabsTrigger value="csv">From CSV</TabsTrigger>
        </TabsList>
        <TabsContent value="ghl">
          <GHLMigration subaccountId={ids[0]} />
        </TabsContent>
        <TabsContent value="csv">
          <CSVImport subaccountId={ids[0]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
