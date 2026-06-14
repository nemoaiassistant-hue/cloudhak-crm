import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { OrgSettings } from "@/components/settings/org-settings";
import { TeamManagement } from "@/components/settings/team-management";
import { ApiKeyManagement } from "@/components/settings/api-key-management";
import { WhiteLabelSettings } from "@/components/settings/white-label";
import { CommsSettings } from "@/components/settings/comms-settings";
import { AuditLogViewer } from "@/components/settings/audit-log-viewer";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's org(s) and sub-accounts
  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select(
      `
      subaccount_id,
      role,
      sub_accounts (
        id,
        org_id,
        name,
        slug,
        branding
      )
    `
    )
    .eq("user_id", user!.id);

  const subAccounts = (roles || []).map((r: Record<string, unknown>) => {
    const sa = r.sub_accounts as Record<string, unknown>;
    return {
      id: sa.id as string,
      name: sa.name as string,
      slug: sa.slug as string,
      branding: sa.branding as Record<string, unknown>,
    };
  });

  // Get org details — look up via sub_accounts.org_id
  let org = null;
  if (subAccounts.length > 0) {
    const { data: saData } = await supabase
      .from("sub_accounts")
      .select("org_id")
      .eq("id", subAccounts[0].id)
      .single();

    if (saData) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, slug, plan_tier")
        .eq("id", saData.org_id)
        .single();
      org = orgData;
    }
  }

  // Get the active sub-account (first one for now)
  const activeSubaccountId = subAccounts[0]?.id;

  // Get team members for active sub-account
  let teamMembers: Array<{
    role_id: string;
    role: string;
    user_id: string;
    email: string;
    full_name: string | null;
  }> = [];

  if (activeSubaccountId) {
    const { data: teamData } = await supabase
      .from("user_subaccount_roles")
      .select(
        `
        id,
        role,
        user_id,
        users (
          email,
          full_name
        )
      `
      )
      .eq("subaccount_id", activeSubaccountId);

    teamMembers = (teamData || []).map((t: Record<string, unknown>) => {
      const u = t.users as Record<string, unknown>;
      return {
        role_id: t.id as string,
        role: t.role as string,
        user_id: t.user_id as string,
        email: u?.email as string,
        full_name: (u?.full_name as string) || null,
      };
    });
  }

  // Get API keys for active sub-account
  let apiKeys: Array<{
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
  }> = [];

  if (activeSubaccountId) {
    const { data: keyData } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, expires_at, created_at")
      .eq("subaccount_id", activeSubaccountId)
      .order("created_at", { ascending: false });

    apiKeys = (keyData || []) as typeof apiKeys;
  }

  // If user has no org/sub-accounts yet
  if (!org || subAccounts.length === 0) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Settings</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Welcome! You don&apos;t have an organization yet.
              <br />
              This happens when you sign up — your organization and first
              sub-account are created automatically.
              <br />
              If you&apos;re seeing this, please sign out and create a new account,
              or ask your admin to invite you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="organization">
        <TabsList className="mb-4">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="branding">White-Label</TabsTrigger>
          <TabsTrigger value="comms">Communications</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <OrgSettings org={org} subAccounts={subAccounts} />
        </TabsContent>

        <TabsContent value="team">
          {activeSubaccountId && (
            <TeamManagement members={teamMembers} subaccountId={activeSubaccountId} />
          )}
        </TabsContent>

        <TabsContent value="api-keys">
          {activeSubaccountId && (
            <ApiKeyManagement keys={apiKeys} subaccountId={activeSubaccountId} />
          )}
        </TabsContent>

        <TabsContent value="branding">
          {activeSubaccountId && (
            <WhiteLabelSettings
              subaccountId={activeSubaccountId}
              initialBranding={subAccounts[0].branding as Record<string, string>}
              subaccountName={subAccounts[0].name}
            />
          )}
        </TabsContent>

        <TabsContent value="comms">
          <CommsSettings />
        </TabsContent>

        <TabsContent value="audit">
          {activeSubaccountId && <AuditLogViewer subaccountId={activeSubaccountId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
