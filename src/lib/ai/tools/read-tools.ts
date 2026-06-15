// ═══════════════════════════════════════════════════════════
// AI Co-Pilot — Read Tools (12 tools)
// All queries are RLS-scoped via the user's authenticated Supabase client
// ═══════════════════════════════════════════════════════════

import type { CrmTool } from "./types";

// ─────────────────────────────────────────────
// 1. SEARCH_CONTACTS
// ─────────────────────────────────────────────
const searchContacts: CrmTool = {
  name: "search_contacts",
  description:
    "Search contacts by name, email, phone, tag, status, or source. Returns matching contacts with key details. Use this when the user asks about specific people or wants to find contacts matching criteria.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term for name, email, or phone" },
      status: {
        type: "string",
        enum: ["lead", "active", "archived", "blocked"],
        description: "Filter by contact status",
      },
      tag: { type: "string", description: "Filter by a specific tag" },
      source: {
        type: "string",
        enum: ["form", "manual", "import", "api"],
        description: "Filter by lead source",
      },
      limit: { type: "number", description: "Max results (default 20, max 50)", default: 20 },
    },
  },
  execute: async (params, ctx) => {
    const { query, status, tag, source, limit = 20 } = params;
    let q = ctx.supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, status, tags, source, created_at, updated_at")
      .eq("subaccount_id", ctx.subaccountId)
      .order("updated_at", { ascending: false })
      .limit(Math.min(limit, 50));

    if (status) q = q.eq("status", status);
    if (source) q = q.eq("source", source);
    if (tag) q = q.contains("tags", [tag]);
    if (query) {
      q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    }

    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: { contacts: data, count: data.length } };
  },
};

// ─────────────────────────────────────────────
// 2. GET_CONTACT_DETAILS
// ─────────────────────────────────────────────
const getContactDetails: CrmTool = {
  name: "get_contact_details",
  description:
    "Get full details for a specific contact, including recent activity log, notes, tasks, and deals. Use when the user wants comprehensive info about one person.",
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "The UUID of the contact" },
    },
    required: ["contact_id"],
  },
  execute: async (params, ctx) => {
    const { contact_id } = params;
    const { data: contact, error } = await ctx.supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("subaccount_id", ctx.subaccountId)
      .single();
    if (error) return { success: false, error: "Contact not found" };

    const [activity, notes, tasks, deals] = await Promise.all([
      ctx.supabase
        .from("contact_activity")
        .select("type, summary, created_at")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(10),
      ctx.supabase
        .from("contact_notes")
        .select("body, created_at")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(5),
      ctx.supabase
        .from("tasks")
        .select("id, title, due_date, priority, completed_at")
        .eq("contact_id", contact_id)
        .order("due_date", { ascending: true }),
      ctx.supabase
        .from("opportunities")
        .select("id, title, value, currency, expected_close_date")
        .eq("contact_id", contact_id),
    ]);

    return {
      success: true,
      data: {
        contact,
        recent_activity: activity.data || [],
        recent_notes: notes.data || [],
        open_tasks: tasks.data || [],
        deals: deals.data || [],
      },
    };
  },
};

// ─────────────────────────────────────────────
// 3. LIST_CONTACTS_BY_STATUS
// ─────────────────────────────────────────────
const listContactsByStatus: CrmTool = {
  name: "list_contacts_by_status",
  description:
    "List contacts filtered by status. Useful for 'show me all leads' or 'how many active customers do we have?'",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["lead", "active", "archived", "blocked"],
        description: "The status to filter by",
      },
      limit: { type: "number", description: "Max results (default 20)", default: 20 },
    },
    required: ["status"],
  },
  execute: async (params, ctx) => {
    const { status, limit = 20 } = params;
    const { data, error, count } = await ctx.supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, tags, source, created_at", { count: "exact" })
      .eq("subaccount_id", ctx.subaccountId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 50));

    if (error) return { success: false, error: error.message };
    return { success: true, data: { contacts: data || [], total_count: count || 0 } };
  },
};

// ─────────────────────────────────────────────
// 4. GET_PIPELINE_SUMMARY
// ─────────────────────────────────────────────
const getPipelineSummary: CrmTool = {
  name: "get_pipeline_summary",
  description:
    "Get a summary of all pipelines and their stages, including deal count and total value per stage. Use for 'how much is in the pipeline?' or 'what does our sales pipeline look like?'",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (params, ctx) => {
    const { data: pipelines, error: pErr } = await ctx.supabase
      .from("pipelines")
      .select("id, name")
      .eq("subaccount_id", ctx.subaccountId)
      .order("sort_order");

    if (pErr) return { success: false, error: pErr.message };
    if (!pipelines?.length) return { success: true, data: { pipelines: [], message: "No pipelines found" } };

    const result = await Promise.all(
      pipelines.map(async (p) => {
        const { data: stages } = await ctx.supabase
          .from("pipeline_stages")
          .select("id, name, probability, color, sort_order")
          .eq("pipeline_id", p.id)
          .order("sort_order");

        const stagesWithDeals = await Promise.all(
          (stages || []).map(async (s) => {
            const { data: deals, count } = await ctx.supabase
              .from("opportunities")
              .select("value", { count: "exact" })
              .eq("stage_id", s.id);

            const totalValue = (deals || []).reduce((sum, d) => sum + Number(d.value), 0);
            return { ...s, deal_count: count || 0, total_value: totalValue };
          })
        );

        const totalValue = stagesWithDeals.reduce((sum, s) => sum + s.total_value, 0);
        const totalDeals = stagesWithDeals.reduce((sum, s) => sum + s.deal_count, 0);

        return { pipeline_name: p.name, stages: stagesWithDeals, total_value: totalValue, total_deals: totalDeals };
      })
    );

    return { success: true, data: { pipelines: result } };
  },
};

// ─────────────────────────────────────────────
// 5. GET_PIPELINE_DEALS
// ─────────────────────────────────────────────
const getPipelineDeals: CrmTool = {
  name: "get_pipeline_deals",
  description:
    "List deals/opportunities in a specific pipeline, optionally filtered by stage. Returns deal details including contact name, value, and expected close date.",
  parameters: {
    type: "object",
    properties: {
      pipeline_name: { type: "string", description: "Name of the pipeline (optional — uses first if omitted)" },
      stage_name: { type: "string", description: "Filter by stage name (e.g. 'New', 'Negotiation', 'Won')" },
      limit: { type: "number", description: "Max results (default 20)", default: 20 },
    },
  },
  execute: async (params, ctx) => {
    const { pipeline_name, stage_name, limit = 20 } = params;
    let pipelineQuery = ctx.supabase
      .from("pipelines")
      .select("id, name")
      .eq("subaccount_id", ctx.subaccountId);

    if (pipeline_name) pipelineQuery = pipelineQuery.ilike("name", `%${pipeline_name}%`);
    else pipelineQuery = pipelineQuery.order("sort_order").limit(1);

    const { data: pipeline } = await pipelineQuery.single();
    if (!pipeline) return { success: false, error: "No pipeline found" };

    let stageFilter = ctx.supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("pipeline_id", pipeline.id);

    if (stage_name) stageFilter = stageFilter.ilike("name", `%${stage_name}%`);

    const { data: stages } = await stageFilter;
    if (!stages?.length) return { success: false, error: "No matching stages found" };

    const stageIds = stages.map((s) => s.id);
    const { data: deals, error } = await ctx.supabase
      .from("opportunities")
      .select(`
        id, title, value, currency, expected_close_date,
        contacts:first_name, contacts:last_name,
        pipeline_stages!inner(name)
      `)
      .in("stage_id", stageIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 50));

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        pipeline: pipeline.name,
        deals: (deals || []).map((d) => ({
          id: d.id,
          title: d.title,
          value: d.value,
          currency: d.currency,
          stage: (d.pipeline_stages as unknown as { name: string })?.name,
          expected_close: d.expected_close_date,
        })),
        count: deals?.length || 0,
      },
    };
  },
};

// ─────────────────────────────────────────────
// 6. GET_TASKS
// ─────────────────────────────────────────────
const getTasks: CrmTool = {
  name: "get_tasks",
  description:
    "Get tasks for this workspace. Can filter by status (open/completed/overdue), priority, or assignee. Use for 'what are my tasks?' or 'show me overdue tasks'.",
  parameters: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        enum: ["open", "completed", "overdue", "all"],
        description: "Filter type (default: open)",
        default: "open",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        description: "Filter by priority level",
      },
      limit: { type: "number", description: "Max results (default 20)", default: 20 },
    },
  },
  execute: async (params, ctx) => {
    const { filter = "open", priority, limit = 20 } = params;
    const now = new Date().toISOString();
    let q = ctx.supabase
      .from("tasks")
      .select("id, title, description, due_date, priority, completed_at, created_at")
      .eq("subaccount_id", ctx.subaccountId);

    if (filter === "open") q = q.is("completed_at", null);
    else if (filter === "completed") q = q.not("completed_at", "is", null);
    else if (filter === "overdue") q = q.lt("due_date", now).is("completed_at", null);

    if (priority) q = q.eq("priority", priority);
    q = q.order("due_date", { ascending: true }).limit(Math.min(limit, 50));

    const { data, error, count } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: { tasks: data || [], count: count || data?.length || 0 } };
  },
};

// ─────────────────────────────────────────────
// 7. GET_CALENDAR_TODAY
// ─────────────────────────────────────────────
const getCalendarToday: CrmTool = {
  name: "get_calendar_today",
  description:
    "Get today's calendar events/appointments. Can also get upcoming events for the next N days.",
  parameters: {
    type: "object",
    properties: {
      days_ahead: {
        type: "number",
        description: "How many days ahead to look (default 1 = today only, 7 = this week)",
        default: 1,
      },
    },
  },
  execute: async (params, ctx) => {
    const { days_ahead = 1 } = params;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + days_ahead);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await ctx.supabase
      .from("calendar_events")
      .select("id, title, description, start_time, end_time, location, type, status")
      .eq("subaccount_id", ctx.subaccountId)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: { events: data || [], count: data?.length || 0 } };
  },
};

// ─────────────────────────────────────────────
// 8. GET_DASHBOARD_STATS
// ─────────────────────────────────────────────
const getDashboardStats: CrmTool = {
  name: "get_dashboard_stats",
  description:
    "Get key metrics for this workspace: total contacts, leads, active customers, deals won value, open tasks, upcoming appointments. Use for general 'how are we doing?' questions.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_params, ctx) => {
    const [contacts, leads, active, openTasks, overdueTasks, upcoming, deals] = await Promise.all([
      ctx.supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", ctx.subaccountId),
      ctx.supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", ctx.subaccountId).eq("status", "lead"),
      ctx.supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", ctx.subaccountId).eq("status", "active"),
      ctx.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("subaccount_id", ctx.subaccountId).is("completed_at", null),
      ctx.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("subaccount_id", ctx.subaccountId).is("completed_at", null).lt("due_date", new Date().toISOString()),
      ctx.supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("subaccount_id", ctx.subaccountId)
        .gte("start_time", new Date().toISOString())
        .eq("status", "scheduled"),
      ctx.supabase.from("opportunities").select("value, currency").eq("subaccount_id", ctx.subaccountId),
    ]);

    const totalDealValue = (deals.data || []).reduce((sum, d) => sum + Number(d.value), 0);

    return {
      success: true,
      data: {
        total_contacts: contacts.count || 0,
        leads: leads.count || 0,
        active_customers: active.count || 0,
        open_tasks: openTasks.count || 0,
        overdue_tasks: overdueTasks.count || 0,
        upcoming_appointments: upcoming.count || 0,
        pipeline_value: totalDealValue,
        currency: "GBP",
      },
    };
  },
};

// ─────────────────────────────────────────────
// 9. GET_FORM_SUBMISSIONS
// ─────────────────────────────────────────────
const getFormSubmissions: CrmTool = {
  name: "get_form_submissions",
  description:
    "Get recent form submissions. Useful for 'any new leads from the website?' or 'show me recent form entries'.",
  parameters: {
    type: "object",
    properties: {
      form_name: { type: "string", description: "Filter by form name (optional)" },
      limit: { type: "number", description: "Max results (default 10)", default: 10 },
    },
  },
  execute: async (params, ctx) => {
    const { form_name, limit = 10 } = params;
    let formQuery = ctx.supabase
      .from("forms")
      .select("id, name")
      .eq("subaccount_id", ctx.subaccountId)
      .eq("is_active", true);

    if (form_name) formQuery = formQuery.ilike("name", `%${form_name}%`);

    const { data: forms } = await formQuery;
    if (!forms?.length) return { success: true, data: { submissions: [], message: "No forms found" } };

    const formIds = forms.map((f) => f.id);
    const { data, error } = await ctx.supabase
      .from("form_submissions")
      .select("id, data, created_at, forms(name)")
      .in("form_id", formIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 30));

    if (error) return { success: false, error: error.message };
    return { success: true, data: { submissions: data || [], count: data?.length || 0 } };
  },
};

// ─────────────────────────────────────────────
// 10. GET_CONVERSATIONS
// ─────────────────────────────────────────────
const getConversations: CrmTool = {
  name: "get_conversations",
  description:
    "Get recent inbox conversations. Can filter for unread only. Use for 'any new messages?' or 'show me the inbox'.",
  parameters: {
    type: "object",
    properties: {
      unread_only: { type: "boolean", description: "Only return unread conversations (default false)", default: false },
      limit: { type: "number", description: "Max results (default 15)", default: 15 },
    },
  },
  execute: async (params, ctx) => {
    const { unread_only = false, limit = 15 } = params;
    let q = ctx.supabase
      .from("conversations")
      .select(`
        id, channel, last_message_at, unread_count, created_at,
        contacts:first_name, contacts:last_name
      `)
      .eq("subaccount_id", ctx.subaccountId);

    if (unread_only) q = q.gt("unread_count", 0);
    q = q.order("last_message_at", { ascending: false }).limit(Math.min(limit, 50));

    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: { conversations: data || [], count: data?.length || 0 } };
  },
};

// ─────────────────────────────────────────────
// 11. GET_CLIENT_OVERVIEW (Agency)
// ─────────────────────────────────────────────
const getClientOverview: CrmTool = {
  name: "get_client_overview",
  description:
    "Get an agency-level overview of all client workspaces (sub-accounts). Shows per-client contact count, deal value, and task count. Admin only.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_params, ctx) => {
    if (ctx.role !== "admin") return { success: false, error: "Agency overview requires admin role" };

    // Get all sub-accounts in the org
    const { data: subAccounts, error: saErr } = await ctx.supabase
      .from("sub_accounts")
      .select("id, name, created_at")
      .eq("org_id", ctx.orgId || "")
      .order("name");

    if (saErr) return { success: false, error: saErr.message };
    if (!subAccounts?.length) return { success: true, data: { clients: [], message: "No client workspaces found" } };

    const clients = await Promise.all(
      subAccounts.map(async (sa) => {
        const [contacts, tasks, deals] = await Promise.all([
          ctx.supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id),
          ctx.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id).is("completed_at", null),
          ctx.supabase.from("opportunities").select("value").eq("subaccount_id", sa.id),
        ]);
        const dealValue = (deals.data || []).reduce((sum, d) => sum + Number(d.value), 0);
        return {
          id: sa.id,
          name: sa.name,
          contacts: contacts.count || 0,
          open_tasks: tasks.count || 0,
          pipeline_value: dealValue,
        };
      })
    );

    const totals = {
      total_contacts: clients.reduce((s, c) => s + c.contacts, 0),
      total_tasks: clients.reduce((s, c) => s + c.open_tasks, 0),
      total_pipeline: clients.reduce((s, c) => s + c.pipeline_value, 0),
    };

    return { success: true, data: { clients, totals } };
  },
};

// ─────────────────────────────────────────────
// 12. GET_STALE_CONTACTS
// ─────────────────────────────────────────────
const getStaleContacts: CrmTool = {
  name: "get_stale_contacts",
  description:
    "Find contacts that haven't been contacted in N days (based on last activity). Very useful for 'who needs a follow-up?' or 'who's going cold?'.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "number", description: "Days since last activity (default 30)", default: 30 },
      status: {
        type: "string",
        enum: ["lead", "active"],
        description: "Only include contacts with this status (default: both lead and active)",
      },
      limit: { type: "number", description: "Max results (default 20)", default: 20 },
    },
  },
  execute: async (params, ctx) => {
    const { days = 30, status, limit = 20 } = params;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Get contacts with no activity since the cutoff
    let q = ctx.supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, status, tags, updated_at")
      .eq("subaccount_id", ctx.subaccountId)
      .lt("updated_at", cutoff.toISOString())
      .order("updated_at", { ascending: true })
      .limit(Math.min(limit, 50));

    if (status) q = q.eq("status", status);
    else q = q.in("status", ["lead", "active"]);

    const { data, error, count } = await q;
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        stale_contacts: data || [],
        count: count || data?.length || 0,
        days_threshold: days,
        message: `${count || 0} contacts haven't been updated in ${days}+ days`,
      },
    };
  },
};

// ─────────────────────────────────────────────
// Export all read tools
// ─────────────────────────────────────────────
export const readTools: CrmTool[] = [
  searchContacts,
  getContactDetails,
  listContactsByStatus,
  getPipelineSummary,
  getPipelineDeals,
  getTasks,
  getCalendarToday,
  getDashboardStats,
  getFormSubmissions,
  getConversations,
  getClientOverview,
  getStaleContacts,
];

export const readToolMap = Object.fromEntries(readTools.map((t) => [t.name, t]));
