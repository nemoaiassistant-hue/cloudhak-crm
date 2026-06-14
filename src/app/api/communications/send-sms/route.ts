import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { to, body, subaccountId, contactId } = await req.json();

    if (!to || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      return NextResponse.json({
        error: "SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
      }, { status: 503 });
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromPhone,
          To: to,
          Body: body,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Twilio error:", err);
      return NextResponse.json({ error: "Failed to send SMS" }, { status: 502 });
    }

    const data = await res.json();

    // Log activity
    if (contactId) {
      await supabase.from("contact_activity").insert({
        contact_id: contactId,
        type: "sms",
        summary: `SMS sent: ${body.substring(0, 80)}`,
        metadata: { to, body, messageId: data.sid },
        created_by: user.id,
      });
    }

    return NextResponse.json({ success: true, messageId: data.sid });
  } catch (error) {
    console.error("Send SMS error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
