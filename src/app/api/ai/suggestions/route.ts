import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

interface Suggestion {
  id: string;
  type: "stale_leads" | "overdue_tasks" | "stuck_deals" | "unanswered_forms" | "no_pipeline" | "wins";
  severity: "info" | "warning" | "urgent";
  title: string;
  description: string;
  count: number;
  prompt: string; // suggested prompt for the AI co-pilot
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subaccountId = req.nextUrl.searchParams.get("subaccountId");
  if (!subaccountId) {
    return NextResponse.json({ error: "Missing subaccountId" }, { status: 400 });
  }

  const suggestions: Suggestion[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Stale contacts (no activity >7 days, still lead/active) ──
  const { data: staleContacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, updated_at")
    .eq("subaccount_id", subaccountId)
    .in("status", ["lead", "active"])
    .lt("updated_at", sevenDaysAgo)
    .order("updated_at", { ascending: true })
    .limit(100);

  const staleCount = staleContacts?.length || 0;
  if (staleCount > 0) {
    suggestions.push({
      id: "stale_leads",
      type: "stale_leads",
      severity: staleCount > 10 ? "urgent" : staleCount > 5 ? "warning" : "info",
      title: `${staleCount} stale ${staleCount === 1 ? "contact" : "contacts"}`,
      description: `${staleCount === 1 ? "A contact has" : `${staleCount} contacts have`} been inactive for 7+ days. Consider reaching out.`,
      count: staleCount,
      prompt: "Show me all stale contacts that haven't been updated in 7+ days",
    });
  }

  // ── 2. Overdue tasks ──
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority")
    .eq("subaccount_id", subaccountId)
    .is("completed_at", null)
    .lt("due_date", now.toISOString())
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(50);

  const overdueCount = overdueTasks?.length || 0;
  if (overdueCount > 0) {
    suggestions.push({
      id: "overdue_tasks",
      type: "overdue_tasks",
      severity: overdueCount > 5 ? "urgent" : "warning",
      title: `${overdueCount} overdue ${overdueCount === 1 ? "task" : "tasks"}`,
      description: `${overdueCount === 1 ? "A task is" : `${overdueCount} tasks are`} past their due date. Review and reschedule.`,
      count: overdueCount,
      prompt: "Show me all overdue tasks",
    });
  }

  // ── 3. Deals stuck in a stage (>14 days in same stage) ──
  const { data: stuckDeals } = await supabase
    .from("opportunities")
    .select(`
      id, title, value, updated_at,
      pipeline_stages ( name )
    `)
    .eq("subaccount_id", subaccountId)
    .not("status", "eq", "won")
    .not("status", "eq", "lost")
    .lt("updated_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .order("value", { ascending: false })
    .limit(20);

  const stuckCount = stuckDeals?.length || 0;
  if (stuckCount > 0) {
    const totalValue = stuckDeals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
    suggestions.push({
      id: "stuck_deals",
      type: "stuck_deals",
      severity: stuckCount > 5 ? "urgent" : "warning",
      title: `${stuckCount} deal${stuckCount === 1 ? "" : "s"} stuck (${totalValue.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })})`,
      description: `${stuckCount === 1 ? "A deal has" : `${stuckCount} deals have`} been in the same stage for 14+ days.`,
      count: stuckCount,
      prompt: "Show me all deals that have been stuck in the same stage for 2+ weeks",
    });
  }

  // ── 4. Unanswered form submissions (last 48h) ──
  const { data: forms } = await supabase
    .from("form_submissions")
    .select("id, created_at, forms ( name )")
    .eq("subaccount_id", subaccountId)
    .eq("status", "new")
    .gt("created_at", new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(30);

  const formCount = forms?.length || 0;
  if (formCount > 0) {
    suggestions.push({
      id: "unanswered_forms",
      type: "unanswered_forms",
      severity: formCount > 3 ? "warning" : "info",
      title: `${formCount} unanswered form ${formCount === 1 ? "submission" : "submissions"}`,
      description: `${formCount} new form ${formCount === 1 ? "submission needs" : "submissions need"} attention from the last 48 hours.`,
      count: formCount,
      prompt: "Show me recent form submissions that haven't been responded to",
    });
  }

  // ── 5. Deals won this week (positive signal) ──
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: wonDeals } = await supabase
    .from("opportunities")
    .select("id, title, value")
    .eq("subaccount_id", subaccountId)
    .eq("status", "won")
    .gt("updated_at", weekAgo);

  const wonCount = wonDeals?.length || 0;
  if (wonCount > 0) {
    const wonValue = wonDeals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
    suggestions.push({
      id: "recent_wins",
      type: "wins",
      severity: "info",
      title: `${wonCount} deal${wonCount === 1 ? "" : "s"} won this week (${wonValue.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })})`,
      description: `Great work! ${wonCount} deal${wonCount === 1 ? "" : "s"} worth ${wonValue.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })} were won this week.`,
      count: wonCount,
      prompt: "Show me details of all deals won this week",
    });
  }

  // Sort: urgent first, then warnings, then info
  const severityOrder = { urgent: 0, warning: 1, info: 2 };
  suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return NextResponse.json({ suggestions, total: suggestions.length });
}
