import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiRequirePermission } from "@/lib/rbac/guards";

export async function POST(req: NextRequest) {
  try {
    // RBAC: only staff+ can send emails
    const { allowed, error } = await apiRequirePermission("inbox.reply");
    if (!allowed && error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { to, subject, body, subaccountId: _subaccountId, contactId } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || "noreply@cloudhak.com";

    if (!apiKey) {
      return NextResponse.json({
        error: "Email service not configured. Set RESEND_API_KEY environment variable.",
      }, { status: 503 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html: body.replace(/\n/g, "<br>"),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
    }

    const data = await res.json();

    // Log activity
    if (contactId) {
      await supabase.from("contact_activity").insert({
        contact_id: contactId,
        type: "email",
        summary: `Email sent: ${subject}`,
        metadata: { to, subject, messageId: data.id },
        created_by: user.id,
      });
    }

    return NextResponse.json({ success: true, messageId: data.id });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
