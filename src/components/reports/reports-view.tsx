"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Users, Filter, FileText, Trophy, PoundSterling,
  Clock, Target, BarChart3, PieChart,
} from "lucide-react";

interface ReportData {
  totalContacts: number;
  newThisWeek: number;
  activeDeals: number;
  wonDeals: number;
  totalPipelineValue: number;
  wonValue: number;
  conversionRate: number;
  activeForms: number;
  totalSubmissions: number;
  pendingTasks: number;
  contactsByStatus: { status: string; count: number }[];
  contactsBySource: { source: string; count: number }[];
  dealsByStage: { stage: string; count: number; value: number }[];
}

export function ReportsView({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      if (!subaccountId) return;
      setLoading(true);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const [
        contactsRes, newContactsRes, activeDealsRes, wonDealsRes,
        pipelineValueRes, wonValueRes, formsRes, submissionsRes,
        tasksRes, contactsByStatusRes, contactsBySourceRes, dealsByStageRes,
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", subaccountId),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", subaccountId).gte("created_at", oneWeekAgo.toISOString()),
        supabase.from("opportunities").select("id, value", { count: "exact" }).eq("subaccount_id", subaccountId),
        supabase.from("opportunities").select("id, value", { count: "exact" }).eq("subaccount_id", subaccountId),
        supabase.from("opportunities").select("value").eq("subaccount_id", subaccountId),
        supabase.from("opportunities").select("value").eq("subaccount_id", subaccountId),
        supabase.from("forms").select("id, is_active", { count: "exact" }).eq("subaccount_id", subaccountId),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("subaccount_id", subaccountId).is("completed_at", null),
        supabase.rpc("count_contacts_by_status", { sa_id: subaccountId }).maybeSingle(),
        supabase.rpc("count_contacts_by_source", { sa_id: subaccountId }).maybeSingle(),
        supabase.rpc("deals_by_stage", { sa_id: subaccountId }).maybeSingle(),
      ]);

      // Fallback: manual aggregation if RPCs don't exist
      let statusBreakdown = contactsByStatusRes.data as { status: string; count: number }[] | null;
      let sourceBreakdown = contactsBySourceRes.data as { source: string; count: number }[] | null;
      let stageBreakdown = dealsByStageRes.data as { stage: string; count: number; value: number }[] | null;

      if (!statusBreakdown) {
        const { data: allContacts } = await supabase.from("contacts").select("status").eq("subaccount_id", subaccountId);
        const counts: Record<string, number> = {};
        (allContacts || []).forEach((c: { status: string }) => {
          counts[c.status] = (counts[c.status] || 0) + 1;
        });
        statusBreakdown = Object.entries(counts).map(([status, count]) => ({ status, count }));
      }

      if (!sourceBreakdown) {
        const { data: allContacts2 } = await supabase.from("contacts").select("source").eq("subaccount_id", subaccountId);
        const counts: Record<string, number> = {};
        (allContacts2 || []).forEach((c: { source: string }) => {
          counts[c.source] = (counts[c.source] || 0) + 1;
        });
        sourceBreakdown = Object.entries(counts).map(([source, count]) => ({ source, count }));
      }

      if (!stageBreakdown) {
        const { data: allDeals } = await supabase
          .from("opportunities")
          .select("stage_id, value, pipeline_stages(name)")
          .eq("subaccount_id", subaccountId);
        const stageMap: Record<string, { name: string; count: number; value: number }> = {};
        const allDealsRaw = allDeals as unknown[] || [];
        allDealsRaw.forEach((rawD) => {
          const d = rawD as Record<string, unknown>;
          const stageId = d.stage_id as string;
          const value = (d.value as number) || 0;
          const ps = d.pipeline_stages as { name: string } | { name: string }[] | null;
          const stageName = Array.isArray(ps) ? ps[0]?.name || "Unknown" : ps?.name || "Unknown";
          if (!stageMap[stageId]) stageMap[stageId] = { name: stageName, count: 0, value: 0 };
          stageMap[stageId].count++;
          stageMap[stageId].value += value;
        });
        stageBreakdown = Object.entries(stageMap).map(([, v]) => ({ stage: v.name, count: v.count, value: v.value }));
      }

      const pipelineValues = (pipelineValueRes.data || []).map((d: { value: number }) => d.value);
      const totalPipelineValue = pipelineValues.reduce((a, b) => a + b, 0);

      const wonValues = (wonValueRes.data || []).map((d: { value: number }) => d.value);
      const wonValue = wonValues.reduce((a, b) => a + b, 0);

      const totalDeals = activeDealsRes.count || 0;

      setData({
        totalContacts: contactsRes.count || 0,
        newThisWeek: newContactsRes.count || 0,
        activeDeals: totalDeals,
        wonDeals: wonDealsRes.count || 0,
        totalPipelineValue,
        wonValue,
        conversionRate: totalDeals > 0 ? Math.round(((wonDealsRes.count || 0) / totalDeals) * 100) : 0,
        activeForms: (formsRes.data || []).filter((f: { is_active: boolean }) => f.is_active).length,
        totalSubmissions: submissionsRes.count || 0,
        pendingTasks: tasksRes.count || 0,
        contactsByStatus: statusBreakdown || [],
        contactsBySource: sourceBreakdown || [],
        dealsByStage: stageBreakdown || [],
      });
      setLoading(false);
    }
    fetchReport();
  }, [subaccountId, supabase]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-pulse text-muted-foreground">Loading reports...</div></div>;
  }

  if (!data) return null;

  const STATUS_COLORS: Record<string, string> = {
    lead: "bg-blue-500", active: "bg-green-500", archived: "bg-gray-500", blocked: "bg-red-500",
  };

  const SOURCE_COLORS: Record<string, string> = {
    form: "bg-purple-500", manual: "bg-blue-500", import: "bg-amber-500", api: "bg-teal-500",
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Contacts</span>
            </div>
            <p className="text-2xl font-bold">{data.totalContacts}</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +{data.newThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pipeline Value</span>
            </div>
            <p className="text-2xl font-bold">£{data.totalPipelineValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{data.activeDeals} active deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold">{data.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">{data.wonDeals} won deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Form Submissions</span>
            </div>
            <p className="text-2xl font-bold">{data.totalSubmissions}</p>
            <p className="text-xs text-muted-foreground">{data.activeForms} active forms</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contacts by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Contacts by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.contactsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {data.contactsByStatus.map((item) => {
                  const max = Math.max(...data.contactsByStatus.map((s) => s.count), 1);
                  const pct = (item.count / max) * 100;
                  return (
                    <div key={item.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm capitalize">{item.status}</span>
                        <span className="text-sm font-medium">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${STATUS_COLORS[item.status] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Contacts by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.contactsBySource.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {data.contactsBySource.map((item) => {
                  const max = Math.max(...data.contactsBySource.map((s) => s.count), 1);
                  const pct = (item.count / max) * 100;
                  return (
                    <div key={item.source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm capitalize">{item.source}</span>
                        <span className="text-sm font-medium">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${SOURCE_COLORS[item.source] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deals by Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Deals by Pipeline Stage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.dealsByStage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No deals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Stage</th>
                    <th className="text-right py-2 font-medium">Deals</th>
                    <th className="text-right py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dealsByStage.map((stage) => (
                    <tr key={stage.stage} className="border-b last:border-0">
                      <td className="py-2">{stage.stage}</td>
                      <td className="text-right py-2">{stage.count}</td>
                      <td className="text-right py-2 font-medium">£{stage.value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Tasks */}
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Pending Tasks</p>
              <p className="text-xs text-muted-foreground">Across all contacts and deals</p>
            </div>
          </div>
          <p className="text-2xl font-bold">{data.pendingTasks}</p>
        </CardContent>
      </Card>
    </div>
  );
}
