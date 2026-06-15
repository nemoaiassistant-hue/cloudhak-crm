// ═══════════════════════════════════════════════════════════
// AI Co-Pilot — Advanced Tools
// Phase 3 (Smart Drafts) + Phase 5 (Pattern Recognition, Cross-Agency, Reporting)
// ═══════════════════════════════════════════════════════════

import type { CrmTool, ToolContext, ToolResult } from "./types";

// ═══════════════════════════════════════════════════════════
// PHASE 3: Smart Drafts (3 tools)
// ═══════════════════════════════════════════════════════════

// ─── 1. DRAFT_FOLLOWUP_SEQUENCE ───
const draftFollowupSequence: CrmTool = {
  name: "draft_followup_sequence",
  description:
    "Generate a multi-step follow-up email/SMS sequence for a segment of contacts. Pulls real contact data for personalization. Returns a ready-to-use sequence draft. Use for 'draft a follow-up sequence for cold leads' or 'create a nurture sequence for new leads'.",
  parameters: {
    type: "object",
    properties: {
      segment: { type: "string", enum: ["cold_leads", "new_leads", "stale_contacts", "all_active", "won_customers"], description: "Which contact segment to target" },
      channel: { type: "string", enum: ["email", "sms", "mixed"], description: "Preferred channel (default: email)" },
      tone: { type: "string", enum: ["professional", "friendly", "urgent", "casual"], description: "Tone of voice (default: professional)" },
      steps: { type: "number", description: "Number of steps in the sequence (default: 3)" },
      business_name: { type: "string", description: "Business name to use in the drafts" },
    },
    required: ["segment"],
  },
  execute: async (params, ctx) => {
    const segment = params.segment || "cold_leads";
    const channel = params.channel || "email";
    const tone = params.tone || "professional";
    const stepCount = Math.min(params.steps || 3, 5);
    const business = params.business_name || "our team";

    // Get a sample of contacts from the segment for personalization context
    let query = ctx.supabase.from("contacts").select("first_name, last_name, email, tags").eq("subaccount_id", ctx.subaccountId);

    if (segment === "cold_leads" || segment === "stale_contacts") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt("updated_at", sevenDaysAgo).in("status", ["lead", "active"]);
    } else if (segment === "new_leads") {
      query = query.eq("status", "lead");
    } else if (segment === "won_customers") {
      query = query.eq("status", "active");
    }

    const { data: contacts, error } = await query.limit(10);
    if (error) return { success: false, error: error.message };

    const contactCount = contacts?.length || 0;
    const sampleNames = contacts?.map((c: { first_name: string }) => c.first_name).filter(Boolean).slice(0, 5) || [];

    // Generate sequence steps
    const steps: Array<{ step: number; delay: string; channel: string; subject?: string; body: string }> = [];

    if (segment === "cold_leads" || segment === "stale_contacts") {
      steps.push({
        step: 1, delay: "Day 0 (immediately)", channel: channel === "sms" ? "sms" : "email",
        subject: channel !== "sms" ? "Checking in — still interested?" : undefined,
        body: `Hi {{first_name}},\n\nI noticed we haven't spoken in a while. I wanted to reach out and see if you're still interested in what ${business} can offer.\n\nWe've helped clients just like you achieve great results, and I'd love to pick up where we left off.\n\nAre you available for a quick call this week?\n\nBest regards,\n${business}`,
      });
      steps.push({
        step: 2, delay: "Day 3", channel: channel === "sms" ? "sms" : "email",
        subject: channel !== "sms" ? "Quick question" : undefined,
        body: `Hi {{first_name}},\n\nJust following up on my last message. I know things get busy!\n\nWould it help if I sent over some information first, so you can review on your own time?\n\nLet me know!\n${business}`,
      });
      steps.push({
        step: 3, delay: "Day 7", channel: "email",
        subject: "Last check-in from us",
        body: `Hi {{first_name}},\n\nThis will be my last message for now. If the timing isn't right, no worries at all — just reply whenever you're ready and I'll be here.\n\nIf there's anything I can help with in the meantime, don't hesitate to reach out.\n\nWarmly,\n${business}`,
      });
    } else if (segment === "new_leads") {
      steps.push({
        step: 1, delay: "Day 0 (immediately)", channel: channel === "sms" ? "sms" : "email",
        subject: channel !== "sms" ? `Welcome to ${business}!` : undefined,
        body: `Hi {{first_name}},\n\nWelcome! Thanks for your interest in ${business}. I'm excited to help you get started.\n\nHere's what happens next:\n• We'll schedule a quick discovery call\n• We'll assess your needs\n• We'll create a tailored plan for you\n\nTalk soon!\n${business}`,
      });
      steps.push({
        step: 2, delay: "Day 1", channel: "email",
        subject: "Here's what makes us different",
        body: `Hi {{first_name}},\n\nWhile you're waiting for our call, I wanted to share a bit about what makes ${business} special.\n\nWe focus on real results, not just promises. Our clients see measurable improvements, and we're committed to your success.\n\nLooking forward to speaking with you!\n${business}`,
      });
      steps.push({
        step: 3, delay: "Day 3", channel: channel === "mixed" ? "sms" : channel,
        subject: channel !== "sms" ? "Ready to chat?" : undefined,
        body: `Hi {{first_name}}, just checking if you'd like to book a call? Reply with a time that works and I'll make it happen. — ${business}`,
      });
    } else {
      // Generic nurture sequence
      for (let i = 0; i < stepCount; i++) {
        steps.push({
          step: i + 1, delay: `Day ${i * 3}`, channel: "email",
          subject: `Step ${i + 1}: Staying in touch`,
          body: `Hi {{first_name}},\n\nThis is touchpoint ${i + 1} of ${stepCount} in our ${tone} sequence. ${business} is here to help.\n\nReach out anytime!`,
        });
      }
    }

    return {
      success: true,
      data: {
        segment,
        audience_size: contactCount,
        sample_contacts: sampleNames,
        tone,
        sequence: steps.slice(0, stepCount),
        note: `Use {{first_name}} and {{last_name}} as personalization tokens. ${contactCount} contacts will receive this.`,
      },
    };
  },
};

// ─── 2. DRAFT_EMAIL ───
const draftEmail: CrmTool = {
  name: "draft_email",
  description:
    "Draft a single personalized email for a specific contact or purpose. Pulls contact data for personalization. Use for 'draft a welcome email for this contact' or 'write an email about our new service'.",
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "UUID of the contact to personalize for (optional if purpose is generic)" },
      purpose: { type: "string", description: "What the email is about (e.g. 'welcome', 'follow-up', 'quote', 'newsletter')" },
      key_points: { type: "array", items: { type: "string" }, description: "Key points to include in the email" },
      tone: { type: "string", enum: ["professional", "friendly", "urgent", "casual"], description: "Tone of voice" },
    },
    required: ["purpose"],
  },
  execute: async (params, ctx) => {
    let contactName = "{{first_name}}";
    let contactEmail = "";

    if (params.contact_id) {
      const { data: contact } = await ctx.supabase
        .from("contacts")
        .select("first_name, last_name, email, tags, status")
        .eq("id", params.contact_id)
        .eq("subaccount_id", ctx.subaccountId)
        .single();

      if (contact) {
        contactName = `${contact.first_name} ${contact.last_name || ""}`.trim();
        contactEmail = contact.email || "";
      }
    }

    const purpose = params.purpose || "general";
    const tone = params.tone || "professional";
    const points = params.key_points || [];

    const tonePrefix: Record<string, string> = {
      professional: "I hope this email finds you well.",
      friendly: "Hope you're having a great day!",
      urgent: "I wanted to reach out to you about something time-sensitive.",
      casual: "Hey! Just wanted to drop you a quick note.",
    };

    const body = `${tonePrefix[tone] || tonePrefix.professional}

${points.length > 0 ? points.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n") : `I wanted to discuss ${purpose} with you.`}

I'd love to hear your thoughts. Are you available for a quick conversation this week?

Best regards`;

    return {
      success: true,
      data: {
        to: contactName,
        email: contactEmail || undefined,
        subject: purpose.charAt(0).toUpperCase() + purpose.slice(1),
        body,
        personalization_token: "{{first_name}}",
      },
    };
  },
};

// ─── 3. DRAFT_TEMPLATE ───
const draftTemplate: CrmTool = {
  name: "draft_template",
  description:
    "Create a reusable email/SMS template and save it to the CRM templates library. Use for 'create a welcome email template' or 'save this as a template for future use'.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Template name (e.g. 'Welcome Email', 'Follow-up SMS')" },
      type: { type: "string", enum: ["email", "sms"], description: "Template type" },
      subject: { type: "string", description: "Email subject line (only for email type)" },
      body: { type: "string", description: "Template body content. Use {{first_name}}, {{last_name}} for personalization." },
      category: { type: "string", description: "Template category (e.g. 'welcome', 'follow-up', 'nurture')" },
    },
    required: ["name", "type", "body"],
  },
  execute: async (params, ctx) => {
    // Check if templates table exists
    const { data, error } = await ctx.supabase
      .from("message_templates")
      .insert({
        subaccount_id: ctx.subaccountId,
        name: params.name,
        type: params.type,
        subject: params.subject || null,
        body: params.body,
        category: params.category || "general",
        created_by: ctx.userId,
      })
      .select("id, name")
      .single();

    if (error) {
      // Table might not exist — return the draft without saving
      return {
        success: true,
        data: {
          name: params.name,
          type: params.type,
          subject: params.subject,
          body: params.body,
          saved: false,
          note: "Template drafted but could not be saved (templates table not found). Copy the content manually.",
        },
      };
    }

    return { success: true, data: { template_id: data.id, name: data.name, saved: true } };
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 5: Pattern Recognition (3 tools)
// ═══════════════════════════════════════════════════════════

// ─── 4. ANALYZE_LEAD_SOURCES ───
const analyzeLeadSources: CrmTool = {
  name: "analyze_lead_sources",
  description:
    "Analyze which lead sources produce the best results (most contacts, highest conversion). Use for 'which lead sources are performing best?' or 'where do my best leads come from?'.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "number", description: "Look back period in days (default: 90)" },
    },
  },
  execute: async (params, ctx) => {
    const days = params.days || 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: contacts, error } = await ctx.supabase
      .from("contacts")
      .select("source, status, created_at")
      .eq("subaccount_id", ctx.subaccountId)
      .gt("created_at", since);

    if (error) return { success: false, error: error.message };
    if (!contacts || contacts.length === 0) return { success: true, data: { message: "No contacts in this period" } };

    // Group by source
    const bySource: Record<string, { total: number; active: number; archived: number; lead: number }> = {};
    for (const c of contacts) {
      const src = c.source || "unknown";
      if (!bySource[src]) bySource[src] = { total: 0, active: 0, archived: 0, lead: 0 };
      bySource[src].total++;
      if (c.status === "active") bySource[src].active++;
      if (c.status === "archived") bySource[src].archived++;
      if (c.status === "lead") bySource[src].lead++;
    }

    // Convert to array + calculate rates
    const analysis = Object.entries(bySource)
      .map(([source, counts]) => ({
        source,
        total: counts.total,
        active: counts.active,
        conversion_rate: counts.total > 0 ? Math.round((counts.active / counts.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const bestSource = analysis[0];
    const bestConversion = [...analysis].sort((a, b) => b.conversion_rate - a.conversion_rate)[0];

    return {
      success: true,
      data: {
        period_days: days,
        total_contacts: contacts.length,
        sources: analysis,
        best_by_volume: bestSource ? bestSource.source : null,
        best_by_conversion: bestConversion && bestConversion.total >= 3 ? bestConversion.source : null,
        insight: bestConversion && bestConversion.total >= 3
          ? `"${bestConversion.source}" has the highest conversion rate at ${bestConversion.conversion_rate}%`
          : bestSource
            ? `"${bestSource.source}" brings in the most leads (${bestSource.total})`
            : "No meaningful patterns yet",
      },
    };
  },
};

// ─── 5. DETECT_COLD_LEADS ───
const detectColdLeads: CrmTool = {
  name: "detect_cold_leads",
  description:
    "Identify contacts who are going cold — leads with declining or no activity. Provides risk scores and recommended actions. Use for 'which leads are going cold?' or 'who should I prioritize following up with?'.",
  parameters: {
    type: "object",
    properties: {
      threshold_days: { type: "number", description: "Days of inactivity to flag as cold (default: 14)" },
      limit: { type: "number", description: "Max results (default: 20)" },
    },
  },
  execute: async (params, ctx) => {
    const thresholdDays = params.threshold_days || 14;
    const limit = Math.min(params.limit || 20, 50);
    const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: contacts, error } = await ctx.supabase
      .from("contacts")
      .select(`
        id, first_name, last_name, email, phone, status, tags, updated_at, created_at,
        contact_activity ( created_at, type )
      `)
      .eq("subaccount_id", ctx.subaccountId)
      .in("status", ["lead", "active"])
      .lt("updated_at", thresholdDate)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) return { success: false, error: error.message };
    if (!contacts || contacts.length === 0) {
      return { success: true, data: { cold_leads: [], message: `No cold leads found (all contacts active within ${thresholdDays} days)` } };
    }

    // Score each lead by coldness
    const scored = contacts.map((c) => {
      const daysSinceUpdate = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      const activity = c.contact_activity as unknown as Array<{ created_at: string }> | null;
      const activityCount = activity?.length || 0;

      let riskScore = 0;
      if (daysSinceUpdate > 30) riskScore += 3;
      else if (daysSinceUpdate > 14) riskScore += 2;
      else riskScore += 1;

      if (activityCount === 0) riskScore += 2;
      else if (activityCount < 3) riskScore += 1;

      if (c.status === "lead") riskScore += 1; // leads going cold is worse

      const riskLevel = riskScore >= 5 ? "critical" : riskScore >= 3 ? "high" : "medium";

      return {
        id: c.id,
        name: `${c.first_name} ${c.last_name || ""}`.trim(),
        email: c.email,
        phone: c.phone,
        days_inactive: daysSinceUpdate,
        activity_count: activityCount,
        status: c.status,
        risk_score: riskScore,
        risk_level: riskLevel,
        recommendation: riskLevel === "critical"
          ? "URGENT: Call immediately or archive"
          : riskLevel === "high"
            ? "Send follow-up email today"
            : "Add to next follow-up batch",
      };
    });

    return {
      success: true,
      data: {
        threshold_days: thresholdDays,
        total_cold: scored.length,
        critical: scored.filter((s) => s.risk_level === "critical").length,
        high: scored.filter((s) => s.risk_level === "high").length,
        medium: scored.filter((s) => s.risk_level === "medium").length,
        cold_leads: scored,
      },
    };
  },
};

// ─── 6. GET_DEALS_AT_RISK ───
const getDealsAtRisk: CrmTool = {
  name: "get_deals_at_risk",
  description:
    "Identify deals that are at risk of stalling or being lost. Analyzes time in stage, deal value, and activity patterns. Use for 'which deals are at risk?' or 'what should I focus on this week?'.",
  parameters: {
    type: "object",
    properties: {
      min_value: { type: "number", description: "Minimum deal value to consider (default: 0)" },
    },
  },
  execute: async (params, ctx) => {
    const minValue = params.min_value || 0;

    const { data: deals, error } = await ctx.supabase
      .from("opportunities")
      .select(`
        id, title, value, status, updated_at, created_at,
        pipeline_stages ( name ),
        contacts ( first_name, last_name )
      `)
      .eq("subaccount_id", ctx.subaccountId)
      .not("status", "eq", "won")
      .not("status", "eq", "lost")
      .gte("value", minValue)
      .order("value", { ascending: false })
      .limit(30);

    if (error) return { success: false, error: error.message };
    if (!deals || deals.length === 0) return { success: true, data: { deals_at_risk: [], message: "No active deals found" } };

    const now = Date.now();
    const scored = deals.map((d) => {
      const daysInStage = Math.floor((now - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      const stage = d.pipeline_stages as unknown as { name: string } | null;

      let riskScore = 0;
      let riskFactors: string[] = [];

      if (daysInStage > 30) {
        riskScore += 3;
        riskFactors.push(`${daysInStage} days in "${stage?.name || "current"}" stage`);
      } else if (daysInStage > 14) {
        riskScore += 2;
        riskFactors.push(`${daysInStage} days in "${stage?.name || "current"}" stage`);
      } else if (daysInStage > 7) {
        riskScore += 1;
        riskFactors.push(`${daysInStage} days since update`);
      }

      if (d.value > 5000 && daysInStage > 14) {
        riskScore += 1;
        riskFactors.push(`High value (${d.value.toLocaleString("en-GB", { style: "currency", currency: "GBP" })}) at risk`);
      }

      const contact = d.contacts as unknown as { first_name: string; last_name: string } | null;

      return {
        id: d.id,
        title: d.title,
        value: d.value,
        stage: stage?.name || "Unknown",
        contact: contact ? `${contact.first_name} ${contact.last_name || ""}`.trim() : null,
        days_in_stage: daysInStage,
        risk_score: riskScore,
        risk_factors: riskFactors,
        recommendation: riskScore >= 4 ? "Schedule a call this week" : riskScore >= 2 ? "Send a check-in email" : "Monitor",
      };
    }).filter((d) => d.risk_score > 0)
      .sort((a, b) => b.risk_score - a.risk_score);

    const totalAtRiskValue = scored.reduce((sum, d) => sum + d.value, 0);

    return {
      success: true,
      data: {
        total_at_risk: scored.length,
        total_value_at_risk: totalAtRiskValue,
        high_risk: scored.filter((s) => s.risk_score >= 4).length,
        deals: scored,
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 5: Cross-Agency Insights (2 tools)
// ═══════════════════════════════════════════════════════════

// ─── 7. GENERATE_AGENCY_REPORT ───
const generateAgencyReport: CrmTool = {
  name: "generate_agency_report",
  description:
    "Generate a comprehensive agency performance report covering contacts, pipeline, tasks, and trends. Use for 'give me a report' or 'how are we doing overall?' or 'generate a weekly summary'.",
  parameters: {
    type: "object",
    properties: {
      period: { type: "string", enum: ["7d", "30d", "90d", "all"], description: "Reporting period (default: 30d)" },
    },
  },
  execute: async (params, ctx) => {
    const period = params.period || "30d";
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, all: 9999 };
    const days = daysMap[period] || 30;
    const since = days < 9999 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : "1970-01-01";

    // Fetch data in parallel-ish
    const [contactsRes, dealsRes, tasksRes, formsRes] = await Promise.all([
      ctx.supabase.from("contacts").select("id, status, source, created_at").eq("subaccount_id", ctx.subaccountId).gt("created_at", since),
      ctx.supabase.from("opportunities").select("id, value, status, created_at, updated_at").eq("subaccount_id", ctx.subaccountId),
      ctx.supabase.from("tasks").select("id, completed_at, due_date, priority").eq("subaccount_id", ctx.subaccountId),
      ctx.supabase.from("form_submissions").select("id, status, created_at").eq("subaccount_id", ctx.subaccountId).gt("created_at", since),
    ]);

    const contacts = contactsRes.data || [];
    const deals = dealsRes.data || [];
    const tasks = tasksRes.data || [];
    const forms = formsRes.data || [];

    // Contacts summary
    const newContacts = contacts.length;
    const activeContacts = contacts.filter((c) => c.status === "active").length;
    const conversionRate = newContacts > 0 ? Math.round((activeContacts / newContacts) * 100) : 0;

    // Pipeline summary
    const wonDeals = deals.filter((d) => d.status === "won");
    const lostDeals = deals.filter((d) => d.status === "lost");
    const activeDeals = deals.filter((d) => d.status !== "won" && d.status !== "lost");
    const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
    const pipelineValue = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
    const dealWinRate = (wonDeals.length + lostDeals.length) > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
      : 0;

    // Tasks summary
    const completedTasks = tasks.filter((t) => t.completed_at).length;
    const overdueTasks = tasks.filter((t) => !t.completed_at && t.due_date && new Date(t.due_date) < new Date()).length;
    const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    // Forms summary
    const newForms = forms.filter((f) => f.status === "new").length;
    const formResponseRate = forms.length > 0 ? Math.round(((forms.length - newForms) / forms.length) * 100) : 0;

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    contacts.forEach((c) => {
      const src = c.source || "unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      success: true,
      data: {
        period,
        generated_at: new Date().toISOString(),
        contacts: {
          new_contacts: newContacts,
          active: activeContacts,
          conversion_rate: conversionRate,
        },
        pipeline: {
          active_deals: activeDeals.length,
          pipeline_value: pipelineValue,
          won_deals: wonDeals.length,
          won_value: wonValue,
          win_rate: dealWinRate,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          overdue: overdueTasks,
          completion_rate: taskCompletionRate,
        },
        forms: {
          submissions: forms.length,
          unanswered: newForms,
          response_rate: formResponseRate,
        },
        top_sources: topSources,
        highlights: [
          `${newContacts} new contacts in the last ${period}`,
          `${wonDeals.length} deals won (${wonValue.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })})`,
          `${pipelineValue.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })} in active pipeline`,
          `${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}`,
          `${conversionRate}% lead-to-active conversion rate`,
        ],
      },
    };
  },
};

// ─── 8. COMPARE_CLIENTS ───
const compareClients: CrmTool = {
  name: "compare_clients",
  description:
    "Compare performance metrics across all sub-accounts/clients in the agency. Shows which clients are performing best by conversion rate, pipeline value, and engagement. Requires agency-level access. Use for 'compare client performance' or 'which client is doing best?'.",
  parameters: {
    type: "object",
    properties: {
      metric: { type: "string", enum: ["conversion", "pipeline_value", "engagement", "all"], description: "Metric to compare by (default: all)" },
    },
  },
  execute: async (params, ctx) => {
    if (!ctx.orgId) return { success: false, error: "No organization context available" };

    // Get all sub-accounts in the org
    const { data: subAccounts, error: saError } = await ctx.supabase
      .from("sub_accounts")
      .select("id, name")
      .eq("org_id", ctx.orgId);

    if (saError) return { success: false, error: saError.message };
    if (!subAccounts || subAccounts.length <= 1) {
      return { success: true, data: { message: "Only one client in this organization — nothing to compare." } };
    }

    // Get aggregate data for each sub-account
    const comparisons: Array<{
      subaccount_id: string;
      name: string;
      total_contacts: number;
      active_contacts: number;
      conversion_rate: number;
      pipeline_value: number;
      won_value: number;
      open_tasks: number;
      score: number;
    }> = [];

    for (const sa of subAccounts) {
      const [contactsRes, dealsRes, tasksRes] = await Promise.all([
        ctx.supabase.from("contacts").select("id, status").eq("subaccount_id", sa.id),
        ctx.supabase.from("opportunities").select("id, value, status").eq("subaccount_id", sa.id),
        ctx.supabase.from("tasks").select("id, completed_at").eq("subaccount_id", sa.id),
      ]);

      const contacts = contactsRes.data || [];
      const deals = dealsRes.data || [];
      const tasks = tasksRes.data || [];

      const activeContacts = contacts.filter((c) => c.status === "active").length;
      const conversionRate = contacts.length > 0 ? Math.round((activeContacts / contacts.length) * 100) : 0;
      const pipelineValue = deals.filter((d) => d.status !== "won" && d.status !== "lost").reduce((s, d) => s + (d.value || 0), 0);
      const wonValue = deals.filter((d) => d.status === "won").reduce((s, d) => s + (d.value || 0), 0);
      const openTasks = tasks.filter((t) => !t.completed_at).length;

      // Simple scoring: conversion (40%) + pipeline value normalized (40%) + task completion (20%)
      const taskRate = tasks.length > 0 ? (tasks.length - openTasks) / tasks.length : 0;
      const pipelineScore = Math.min(pipelineValue / 50000, 1); // Cap at £50k for scoring
      const score = Math.round((conversionRate / 100 * 0.4 + pipelineScore * 0.4 + taskRate * 0.2) * 100);

      comparisons.push({
        subaccount_id: sa.id,
        name: sa.name,
        total_contacts: contacts.length,
        active_contacts: activeContacts,
        conversion_rate: conversionRate,
        pipeline_value: pipelineValue,
        won_value: wonValue,
        open_tasks: openTasks,
        score,
      });
    }

    comparisons.sort((a, b) => b.score - a.score);

    const best = comparisons[0];
    const worst = comparisons[comparisons.length - 1];

    return {
      success: true,
      data: {
        total_clients: comparisons.length,
        rankings: comparisons,
        best_performer: best ? { name: best.name, score: best.score } : null,
        needs_attention: worst ? { name: worst.name, score: worst.score } : null,
        insight: best && worst
          ? `"${best.name}" is the top performer (score: ${best.score}). "${worst.name}" may need attention (score: ${worst.score}).`
          : "Not enough data for insights",
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════

export const advancedTools: CrmTool[] = [
  // Phase 3: Smart Drafts
  draftFollowupSequence,
  draftEmail,
  draftTemplate,
  // Phase 5: Pattern Recognition
  analyzeLeadSources,
  detectColdLeads,
  getDealsAtRisk,
  // Phase 5: Cross-Agency + Reporting
  generateAgencyReport,
  compareClients,
];

export const advancedToolMap = Object.fromEntries(advancedTools.map((t) => [t.name, t]));
