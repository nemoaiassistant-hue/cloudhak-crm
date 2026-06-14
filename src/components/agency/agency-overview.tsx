"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Building2, TrendingUp, PoundSterling, Filter,
  FileText, Zap, MessageSquare, ArrowRight, Activity,
} from "lucide-react";
import Link from "next/link";

interface ClientStats {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
  contactCount: number;
  dealCount: number;
  pipelineValue: number;
  activeAutomations: number;
  teamCount: number;
  formCount: number;
  submissionCount: number;
  created_at: string;
}

interface OrgStats {
  totalClients: number;
  totalContacts: number;
  totalDeals: number;
  totalPipelineValue: number;
  totalAutomations: number;
  totalTeam: number;
  totalForms: number;
  totalSubmissions: number;
  clients: ClientStats[];
}

export function AgencyOverview({ orgId }: { orgId: string }) {
  const supabase = createClient();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgencyStats() {
      if (!orgId) return;
      setLoading(true);

      // Get all sub-accounts in this org
      const { data: subAccounts } = await supabase
        .from("sub_accounts")
        .select("id, name, slug, branding, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (!subAccounts || subAccounts.length === 0) {
        setStats(null);
        setLoading(false);
        return;
      }

      // For each sub-account, fetch stats in parallel
      const clientStatsPromises = subAccounts.map(async (sa) => {
        const saId = sa.id;

        const [
          contactsRes, dealsRes, pipelineRes, automationsRes,
          teamRes, formsRes, submissionsRes,
        ] = await Promise.all([
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", saId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("subaccount_id", saId),
          supabase.from("opportunities").select("value").eq("subaccount_id", saId),
          supabase.from("workflows").select("id", { count: "exact", head: true }).eq("subaccount_id", saId).eq("enabled", true),
          supabase.from("user_subaccount_roles").select("id", { count: "exact", head: true }).eq("subaccount_id", saId),
          supabase.from("forms").select("id", { count: "exact", head: true }).eq("subaccount_id", saId),
          supabase.from("form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("form_id",
              (await supabase.from("forms").select("id").eq("subaccount_id", saId)).data?.map((f: { id: string }) => f.id) || []
            ),
        ]);

        const pipelineValue = (pipelineRes.data || []).reduce((sum: number, d: { value: number }) => sum + (d.value || 0), 0);

        return {
          id: saId,
          name: sa.name,
          slug: sa.slug,
          branding: sa.branding as Record<string, unknown>,
          contactCount: contactsRes.count || 0,
          dealCount: dealsRes.count || 0,
          pipelineValue,
          activeAutomations: automationsRes.count || 0,
          teamCount: teamRes.count || 0,
          formCount: formsRes.count || 0,
          submissionCount: submissionsRes.count || 0,
          created_at: sa.created_at,
        } as ClientStats;
      });

      const clients = await Promise.all(clientStatsPromises);

      const aggregate: OrgStats = {
        totalClients: clients.length,
        totalContacts: clients.reduce((a, c) => a + c.contactCount, 0),
        totalDeals: clients.reduce((a, c) => a + c.dealCount, 0),
        totalPipelineValue: clients.reduce((a, c) => a + c.pipelineValue, 0),
        totalAutomations: clients.reduce((a, c) => a + c.activeAutomations, 0),
        totalTeam: clients.reduce((a, c) => a + c.teamCount, 0),
        totalForms: clients.reduce((a, c) => a + c.formCount, 0),
        totalSubmissions: clients.reduce((a, c) => a + c.submissionCount, 0),
        clients,
      };

      setStats(aggregate);
      setLoading(false);
    }
    fetchAgencyStats();
  }, [orgId, supabase]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground mb-4">No client workspaces yet.</p>
          <Link href="/dashboard/agency/clients">
            <Button>Create your first client workspace</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agency KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Client Workspaces</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalClients}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Contacts</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Across all clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pipeline Value</span>
            </div>
            <p className="text-2xl font-bold">£{stats.totalPipelineValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{stats.totalDeals} active deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Team Members</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalTeam}</p>
            <p className="text-xs text-muted-foreground">{stats.totalAutomations} active automations</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Client Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Client Workspaces</CardTitle>
          <Link href="/dashboard/agency/clients">
            <Button variant="outline" size="sm">
              Manage Clients <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Client</th>
                  <th className="text-right p-3 font-medium">Contacts</th>
                  <th className="text-right p-3 font-medium">Deals</th>
                  <th className="text-right p-3 font-medium">Pipeline</th>
                  <th className="text-right p-3 font-medium">Forms</th>
                  <th className="text-right p-3 font-medium">Submissions</th>
                  <th className="text-right p-3 font-medium">Automations</th>
                  <th className="text-right p-3 font-medium">Team</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.clients.map((client) => (
                  <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: (client.branding?.primaryColor as string) || "#6366f1" }}
                        >
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">/{client.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right p-3">{client.contactCount.toLocaleString()}</td>
                    <td className="text-right p-3">{client.dealCount}</td>
                    <td className="text-right p-3 font-medium">£{client.pipelineValue.toLocaleString()}</td>
                    <td className="text-right p-3">{client.formCount}</td>
                    <td className="text-right p-3">{client.submissionCount}</td>
                    <td className="text-right p-3">{client.activeAutomations}</td>
                    <td className="text-right p-3">{client.teamCount}</td>
                    <td className="text-center p-3">
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-medium">
                  <td className="p-3">All Clients</td>
                  <td className="text-right p-3">{stats.totalContacts.toLocaleString()}</td>
                  <td className="text-right p-3">{stats.totalDeals}</td>
                  <td className="text-right p-3">£{stats.totalPipelineValue.toLocaleString()}</td>
                  <td className="text-right p-3">{stats.totalForms}</td>
                  <td className="text-right p-3">{stats.totalSubmissions}</td>
                  <td className="text-right p-3">{stats.totalAutomations}</td>
                  <td className="text-right p-3">{stats.totalTeam}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/agency/clients">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Manage Clients</p>
                <p className="text-xs text-muted-foreground">Create, edit, configure workspaces</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/agency/reports">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Agency Reports</p>
                <p className="text-xs text-muted-foreground">Cross-account analytics</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/settings">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Agency Settings</p>
                <p className="text-xs text-muted-foreground">Org settings, branding, API</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
