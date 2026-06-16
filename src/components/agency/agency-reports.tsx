"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Users, PoundSterling, Target, FileText,
  BarChart3, PieChart, Trophy,
} from "lucide-react";

interface ClientReport {
  id: string;
  name: string;
  contacts: number;
  newThisWeek: number;
  deals: number;
  pipelineValue: number;
  wonValue: number;
  forms: number;
  submissions: number;
  automations: number;
}

export function AgencyReports({ orgId }: { orgId: string }) {
  const supabase = createClient();
  const [clients, setClients] = useState<ClientReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      if (!orgId) return;
      setLoading(true);

      const { data: subAccounts } = await supabase
        .from("sub_accounts")
        .select("id, name")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (!subAccounts) {
        setClients([]);
        setLoading(false);
        return;
      }

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const reports = await Promise.all(
        subAccounts.map(async (sa) => {
          const [
            contactsRes, newContactsRes, dealsRes, pipelineRes,
            formsRes, submissionsRes, automationsRes,
          ] = await Promise.all([
            supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id),
            supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id).gte("created_at", oneWeekAgo.toISOString()),
            supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id),
            supabase.from("opportunities").select("value").eq("subaccount_id", sa.id),
            supabase.from("forms").select("id, is_active").eq("subaccount_id", sa.id),
            supabase.from("form_submissions").select("id", { count: "exact", head: true }),
            supabase.from("workflows").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id).eq("enabled", true),
          ]);

          const pipelineValue = (pipelineRes.data || []).reduce((sum: number, d: { value: number }) => sum + (d.value || 0), 0);

          return {
            id: sa.id,
            name: sa.name,
            contacts: contactsRes.count || 0,
            newThisWeek: newContactsRes.count || 0,
            deals: dealsRes.count || 0,
            pipelineValue,
            wonValue: 0,
            forms: (formsRes.data || []).filter((f: { is_active: boolean }) => f.is_active).length,
            submissions: submissionsRes.count || 0,
            automations: automationsRes.count || 0,
          } as ClientReport;
        })
      );

      setClients(reports);
      setLoading(false);
    }
    fetchReports();
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

  const totals = {
    contacts: clients.reduce((a, c) => a + c.contacts, 0),
    newThisWeek: clients.reduce((a, c) => a + c.newThisWeek, 0),
    deals: clients.reduce((a, c) => a + c.deals, 0),
    pipelineValue: clients.reduce((a, c) => a + c.pipelineValue, 0),
    forms: clients.reduce((a, c) => a + c.forms, 0),
    submissions: clients.reduce((a, c) => a + c.submissions, 0),
    automations: clients.reduce((a, c) => a + c.automations, 0),
  };

  // Sort by pipeline value for the chart
  const sortedByValue = [...clients].sort((a, b) => b.pipelineValue - a.pipelineValue);
  const sortedByContacts = [...clients].sort((a, b) => b.contacts - a.contacts);
  const maxPipeline = Math.max(...sortedByValue.map((c) => c.pipelineValue), 1);
  const maxContacts = Math.max(...sortedByContacts.map((c) => c.contacts), 1);

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#ef4444"];

  return (
    <div className="space-y-6">
      {/* Agency Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Contacts</span>
            </div>
            <p className="text-2xl font-bold">{totals.contacts.toLocaleString()}</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +{totals.newThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Pipeline</span>
            </div>
            <p className="text-2xl font-bold">£{totals.pipelineValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{totals.deals} active deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Form Submissions</span>
            </div>
            <p className="text-2xl font-bold">{totals.submissions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{totals.forms} active forms</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Automations</span>
            </div>
            <p className="text-2xl font-bold">{totals.automations}</p>
            <p className="text-xs text-muted-foreground">Active workflows</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Client */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Pipeline Value by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedByValue.length === 0 || sortedByValue[0].pipelineValue === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pipeline data yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedByValue.map((client, i) => (
                  <div key={client.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{client.name}</span>
                      <span className="text-sm font-medium">£{client.pipelineValue.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(client.pipelineValue / maxPipeline) * 100}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts by Client */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Contacts by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedByContacts.length === 0 || sortedByContacts[0].contacts === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No contact data yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedByContacts.map((client, i) => (
                  <div key={client.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{client.name}</span>
                      <span className="text-sm font-medium">{client.contacts.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(client.contacts / maxContacts) * 100}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Client Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium whitespace-nowrap">Client</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Contacts</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">New (7d)</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Deals</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Pipeline</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Forms</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Submissions</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Automations</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => (
                  <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        >
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </td>
                    <td className="text-right p-3">{client.contacts.toLocaleString()}</td>
                    <td className="text-right p-3">
                      {client.newThisWeek > 0 ? (
                        <span className="text-green-600">+{client.newThisWeek}</span>
                      ) : "—"}
                    </td>
                    <td className="text-right p-3">{client.deals}</td>
                    <td className="text-right p-3 font-medium">£{client.pipelineValue.toLocaleString()}</td>
                    <td className="text-right p-3">{client.forms}</td>
                    <td className="text-right p-3">{client.submissions}</td>
                    <td className="text-right p-3">{client.automations}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-medium">
                  <td className="p-3">All Clients</td>
                  <td className="text-right p-3">{totals.contacts.toLocaleString()}</td>
                  <td className="text-right p-3 text-green-600">+{totals.newThisWeek}</td>
                  <td className="text-right p-3">{totals.deals}</td>
                  <td className="text-right p-3">£{totals.pipelineValue.toLocaleString()}</td>
                  <td className="text-right p-3">{totals.forms}</td>
                  <td className="text-right p-3">{totals.submissions.toLocaleString()}</td>
                  <td className="text-right p-3">{totals.automations}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
