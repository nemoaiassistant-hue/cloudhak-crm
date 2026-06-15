// ═══════════════════════════════════════════════════════════
// AI Co-Pilot — Write Tools (10 tools)
// All mutations are RLS-scoped + audit-logged
// ═══════════════════════════════════════════════════════════

import type { CrmTool, ToolContext, ToolResult } from "./types";

// ─── Helper: write to audit log ───
async function logAudit(
  ctx: ToolContext,
  action: string,
  entityType: string,
  entityId: string | null,
  changes: Record<string, unknown>
): Promise<void> {
  try {
    await ctx.supabase.from("audit_log").insert({
      subaccount_id: ctx.subaccountId,
      user_id: ctx.userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes,
    });
  } catch {
    // Audit log failure should not block the action
  }
}

// ─── RBAC check helper ───
function canWrite(ctx: ToolContext): boolean {
  return ctx.role === "admin" || ctx.role === "manager" || ctx.role === "staff";
}

// ─────────────────────────────────────────────
// 1. CREATE_TASK (no confirmation)
// ─────────────────────────────────────────────
const createTask: CrmTool = {
  name: "create_task",
  description:
    "Create a new task in the CRM. Can assign to a contact and set priority. Use when the user asks to create a reminder, follow-up task, or action item.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The task title (required)" },
      description: { type: "string", description: "Optional task description" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Priority (default: medium)" },
      due_date: { type: "string", description: "Due date in ISO format (e.g. 2024-12-25)" },
      contact_id: { type: "string", description: "Optional UUID of a contact to link" },
    },
    required: ["title"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions (viewer role cannot create tasks)" };

    const { data, error } = await ctx.supabase
      .from("tasks")
      .insert({
        subaccount_id: ctx.subaccountId,
        title: params.title,
        description: params.description || null,
        priority: params.priority || "medium",
        due_date: params.due_date || null,
        contact_id: params.contact_id || null,
        created_by: ctx.userId,
      })
      .select("id, title")
      .single();

    if (error) return { success: false, error: error.message };

    await logAudit(ctx, "ai_create_task", "task", data.id, { title: params.title });
    return { success: true, data: { task_id: data.id, title: data.title } };
  },
};

// ─────────────────────────────────────────────
// 2. UPDATE_TASK_STATUS (no confirmation)
// ─────────────────────────────────────────────
const updateTaskStatus: CrmTool = {
  name: "update_task_status",
  description:
    "Update a task's status — mark as complete or reopen. Use for 'mark that done' or 'complete this task'.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The UUID of the task" },
      status: { type: "string", enum: ["completed", "open"], description: "New status" },
    },
    required: ["task_id", "status"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    const updateData = params.status === "completed"
      ? { completed_at: new Date().toISOString() }
      : { completed_at: null };

    const { error } = await ctx.supabase
      .from("tasks")
      .update(updateData)
      .eq("id", params.task_id)
      .eq("subaccount_id", ctx.subaccountId);

    if (error) return { success: false, error: error.message };

    await logAudit(ctx, "ai_update_task", "task", params.task_id, { status: params.status });
    return { success: true, data: { task_id: params.task_id, new_status: params.status } };
  },
};

// ─────────────────────────────────────────────
// 3. UPDATE_CONTACT_STATUS (no confirmation)
// ─────────────────────────────────────────────
const updateContactStatus: CrmTool = {
  name: "update_contact_status",
  description:
    "Update a contact's lead status. Use for 'mark as active', 'archive this contact', or 'this lead is now a customer'.",
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "The UUID of the contact" },
      status: { type: "string", enum: ["lead", "active", "archived", "blocked"], description: "New status" },
    },
    required: ["contact_id", "status"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    const { data, error } = await ctx.supabase
      .from("contacts")
      .update({ status: params.status, updated_at: new Date().toISOString() })
      .eq("id", params.contact_id)
      .eq("subaccount_id", ctx.subaccountId)
      .select("first_name, last_name")
      .single();

    if (error) return { success: false, error: error.message };

    // Also log as activity on the contact
    await ctx.supabase.from("contact_activity").insert({
      contact_id: params.contact_id,
      type: "status_change",
      summary: `Status changed to "${params.status}" via AI Co-Pilot`,
      created_by: ctx.userId,
    });

    await logAudit(ctx, "ai_update_contact_status", "contact", params.contact_id, { status: params.status });
    return { success: true, data: { contact_id: params.contact_id, contact_name: `${data.first_name} ${data.last_name}`, new_status: params.status } };
  },
};

// ─────────────────────────────────────────────
// 4. ADD_CONTACT_TAG (no confirmation)
// ─────────────────────────────────────────────
const addContactTag: CrmTool = {
  name: "add_contact_tag",
  description:
    "Add one or more tags to a contact, or remove tags. Use for 'tag this lead as hot' or 'add VIP tag to this contact'.",
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "The UUID of the contact" },
      add_tags: { type: "array", items: { type: "string" }, description: "Tags to add" },
      remove_tags: { type: "array", items: { type: "string" }, description: "Tags to remove" },
    },
    required: ["contact_id"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    // Fetch current tags
    const { data: contact, error: fErr } = await ctx.supabase
      .from("contacts")
      .select("tags")
      .eq("id", params.contact_id)
      .eq("subaccount_id", ctx.subaccountId)
      .single();

    if (fErr) return { success: false, error: fErr.message };

    let tags = contact.tags || [];
    const addTags = params.add_tags || [];
    const removeTags = params.remove_tags || [];

    tags = [...new Set([...tags.filter((t: string) => !removeTags.includes(t)), ...addTags])];

    const { error } = await ctx.supabase
      .from("contacts")
      .update({ tags, updated_at: new Date().toISOString() })
      .eq("id", params.contact_id);

    if (error) return { success: false, error: error.message };

    await logAudit(ctx, "ai_update_tags", "contact", params.contact_id, { added: addTags, removed: removeTags, final_tags: tags });
    return { success: true, data: { contact_id: params.contact_id, tags } };
  },
};

// ─────────────────────────────────────────────
// 5. ADD_CONTACT_NOTE (no confirmation)
// ─────────────────────────────────────────────
const addContactNote: CrmTool = {
  name: "add_contact_note",
  description:
    "Add a note to a contact's record. Useful for logging call outcomes, meeting notes, or context. Use for 'add a note to this contact' or 'log that I called them'.",
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "The UUID of the contact" },
      note: { type: "string", description: "The note content" },
      is_internal: { type: "boolean", description: "If true, note is internal only (default: false)" },
    },
    required: ["contact_id", "note"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    const { data, error } = await ctx.supabase
      .from("contact_notes")
      .insert({
        contact_id: params.contact_id,
        author_id: ctx.userId,
        body: params.note,
        is_internal: params.is_internal || false,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    // Also log as activity
    await ctx.supabase.from("contact_activity").insert({
      contact_id: params.contact_id,
      type: "note",
      summary: `Note added via AI Co-Pilot: ${params.note.slice(0, 100)}`,
      created_by: ctx.userId,
    });

    await logAudit(ctx, "ai_add_note", "contact_note", data.id, { contact_id: params.contact_id });
    return { success: true, data: { note_id: data.id, contact_id: params.contact_id } };
  },
};

// ─────────────────────────────────────────────
// 6. MOVE_DEAL_STAGE (requires confirmation ✅)
// ─────────────────────────────────────────────
const moveDealStage: CrmTool = {
  name: "move_deal_stage",
  description:
    "Move a deal/opportunity to a different pipeline stage. Use for 'move this deal to negotiation' or 'mark this deal as won'. REQUIRES CONFIRMATION.",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      opportunity_id: { type: "string", description: "The UUID of the opportunity/deal" },
      target_stage_name: { type: "string", description: "Name of the target stage (e.g. 'Negotiation', 'Won', 'Lost')" },
    },
    required: ["opportunity_id", "target_stage_name"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    // Find the target stage
    const { data: deal } = await ctx.supabase
      .from("opportunities")
      .select("pipeline_id, title")
      .eq("id", params.opportunity_id)
      .eq("subaccount_id", ctx.subaccountId)
      .single();

    if (!deal) return { success: false, error: "Deal not found" };

    const { data: stage } = await ctx.supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("pipeline_id", deal.pipeline_id)
      .ilike("name", `%${params.target_stage_name}%`)
      .single();

    if (!stage) return { success: false, error: `Stage "${params.target_stage_name}" not found` };

    const { error } = await ctx.supabase
      .from("opportunities")
      .update({ stage_id: stage.id, updated_at: new Date().toISOString() })
      .eq("id", params.opportunity_id);

    if (error) return { success: false, error: error.message };

    await logAudit(ctx, "ai_move_deal", "opportunity", params.opportunity_id, {
      deal_title: deal.title,
      target_stage: stage.name,
    });
    return { success: true, data: { opportunity_id: params.opportunity_id, new_stage: stage.name } };
  },
};

// ─────────────────────────────────────────────
// 7. CREATE_CONTACT (requires confirmation ✅)
// ─────────────────────────────────────────────
const createContact: CrmTool = {
  name: "create_contact",
  description:
    "Create a new contact in the CRM. Use for 'add a new lead' or 'create a contact for John Smith'. REQUIRES CONFIRMATION.",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      first_name: { type: "string", description: "First name (required)" },
      last_name: { type: "string", description: "Last name" },
      email: { type: "string", description: "Email address" },
      phone: { type: "string", description: "Phone number" },
      status: { type: "string", enum: ["lead", "active"], description: "Contact status (default: lead)" },
      tags: { type: "array", items: { type: "string" }, description: "Initial tags" },
      source: { type: "string", enum: ["manual", "api"], description: "Source (default: manual)" },
    },
    required: ["first_name"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    const { data, error } = await ctx.supabase
      .from("contacts")
      .insert({
        subaccount_id: ctx.subaccountId,
        first_name: params.first_name,
        last_name: params.last_name || "",
        email: params.email || null,
        phone: params.phone || null,
        status: params.status || "lead",
        tags: params.tags || [],
        source: params.source || "manual",
      })
      .select("id, first_name, last_name")
      .single();

    if (error) return { success: false, error: error.message };

    // Log activity
    await ctx.supabase.from("contact_activity").insert({
      contact_id: data.id,
      type: "created",
      summary: "Contact created via AI Co-Pilot",
      created_by: ctx.userId,
    });

    await logAudit(ctx, "ai_create_contact", "contact", data.id, { name: `${data.first_name} ${data.last_name}` });
    return { success: true, data: { contact_id: data.id, name: `${data.first_name} ${data.last_name}` } };
  },
};

// ─────────────────────────────────────────────
// 8. SEND_EMAIL (requires confirmation ✅)
// ─────────────────────────────────────────────
const sendEmail: CrmTool = {
  name: "send_email",
  description:
    "Send an email to a contact via the CRM's email service (Resend). Requires email service to be configured. REQUIRES CONFIRMATION.",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "The UUID of the contact to email" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body content" },
    },
    required: ["contact_id", "subject", "body"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    // Get contact email
    const { data: contact } = await ctx.supabase
      .from("contacts")
      .select("email, first_name, last_name")
      .eq("id", params.contact_id)
      .eq("subaccount_id", ctx.subaccountId)
      .single();

    if (!contact?.email) return { success: false, error: "Contact has no email address" };

    // Send via internal API
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/communications/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: contact.email,
        subject: params.subject,
        body: params.body,
        subaccountId: ctx.subaccountId,
        contactId: params.contact_id,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Email send failed: ${err}` };
    }

    // Log as activity
    await ctx.supabase.from("contact_activity").insert({
      contact_id: params.contact_id,
      type: "email",
      summary: `Email sent via AI Co-Pilot: "${params.subject}"`,
      created_by: ctx.userId,
    });

    await logAudit(ctx, "ai_send_email", "contact", params.contact_id, {
      to: contact.email,
      subject: params.subject,
    });
    return { success: true, data: { sent_to: contact.email, subject: params.subject } };
  },
};

// ─────────────────────────────────────────────
// 9. SEND_SMS (requires confirmation ✅)
// ─────────────────────────────────────────────
const sendSms: CrmTool = {
  name: "send_sms",
  description:
    "Send an SMS to a contact via the CRM's SMS service (Twilio). Requires SMS service to be configured. REQUIRES CONFIRMATION.",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      contact_id: { type: "string", description: "The UUID of the contact to text" },
      body: { type: "string", description: "SMS message content (max 1600 chars)" },
    },
    required: ["contact_id", "body"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    const { data: contact } = await ctx.supabase
      .from("contacts")
      .select("phone, first_name, last_name")
      .eq("id", params.contact_id)
      .eq("subaccount_id", ctx.subaccountId)
      .single();

    if (!contact?.phone) return { success: false, error: "Contact has no phone number" };

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/communications/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: contact.phone,
        body: params.body,
        subaccountId: ctx.subaccountId,
        contactId: params.contact_id,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `SMS send failed: ${err}` };
    }

    await ctx.supabase.from("contact_activity").insert({
      contact_id: params.contact_id,
      type: "sms",
      summary: `SMS sent via AI Co-Pilot: ${params.body.slice(0, 100)}`,
      created_by: ctx.userId,
    });

    await logAudit(ctx, "ai_send_sms", "contact", params.contact_id, {
      to: contact.phone,
      preview: params.body.slice(0, 100),
    });
    return { success: true, data: { sent_to: contact.phone } };
  },
};

// ─────────────────────────────────────────────
// 10. BULK_UPDATE_TAGS (requires confirmation ✅)
// ─────────────────────────────────────────────
const bulkUpdateTags: CrmTool = {
  name: "bulk_update_tags",
  description:
    "Add a tag to multiple contacts at once. Use for 'tag all stale leads as follow-up' or 'add VIP to these contacts'. REQUIRES CONFIRMATION.",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      contact_ids: { type: "array", items: { type: "string" }, description: "Array of contact UUIDs" },
      add_tag: { type: "string", description: "The tag to add to all contacts" },
    },
    required: ["contact_ids", "add_tag"],
  },
  execute: async (params, ctx) => {
    if (!canWrite(ctx)) return { success: false, error: "Insufficient permissions" };

    const contactIds: string[] = params.contact_ids || [];
    if (contactIds.length === 0) return { success: false, error: "No contacts specified" };

    let updated = 0;
    let failed = 0;

    // Process in batches of 50
    for (let i = 0; i < contactIds.length; i += 50) {
      const batch = contactIds.slice(i, i + 50);

      // Fetch current tags
      const { data: contacts } = await ctx.supabase
        .from("contacts")
        .select("id, tags")
        .in("id", batch)
        .eq("subaccount_id", ctx.subaccountId);

      for (const c of contacts || []) {
        const tags = c.tags || [];
        if (!tags.includes(params.add_tag)) {
          tags.push(params.add_tag);
          const { error } = await ctx.supabase
            .from("contacts")
            .update({ tags, updated_at: new Date().toISOString() })
            .eq("id", c.id);

          if (error) failed++;
          else updated++;
        } else {
          updated++; // Already has tag
        }
      }
    }

    await logAudit(ctx, "ai_bulk_tag", "contact", null, {
      tag: params.add_tag,
      contact_count: contactIds.length,
      updated,
      failed,
    });

    return { success: true, data: { tag: params.add_tag, updated, failed, total: contactIds.length } };
  },
};

// ─────────────────────────────────────────────
// Export all write tools
// ─────────────────────────────────────────────
export const writeTools: CrmTool[] = [
  createTask,
  updateTaskStatus,
  updateContactStatus,
  addContactTag,
  addContactNote,
  moveDealStage,
  createContact,
  sendEmail,
  sendSms,
  bulkUpdateTags,
];

export const writeToolMap = Object.fromEntries(writeTools.map((t) => [t.name, t]));

// Human-readable labels for action cards
export const WRITE_TOOL_LABELS: Record<string, string> = {
  create_task: "Create Task",
  update_task_status: "Update Task Status",
  update_contact_status: "Update Contact Status",
  add_contact_tag: "Update Tags",
  add_contact_note: "Add Note",
  move_deal_stage: "Move Deal",
  create_contact: "Create Contact",
  send_email: "Send Email",
  send_sms: "Send SMS",
  bulk_update_tags: "Bulk Tag Contacts",
};
