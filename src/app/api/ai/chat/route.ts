import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are the CloudHak CRM AI Assistant. You help CRM users with:
- Writing email/SMS templates for outreach
- Summarizing contact activity and suggesting next steps
- Drafting automation workflow ideas
- Analyzing pipeline data and suggesting improvements
- Answering questions about CRM features

Keep responses concise and actionable. Use bullet points. When suggesting outreach, include the actual text they can copy.

If asked about specific contacts or data, explain that you need them to share the context since you don't have direct database access in this mode.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages, contextType, contextId, subaccountId } = body as {
      messages: Array<{ role: string; content: string }>;
      contextType?: string;
      contextId?: string;
      subaccountId?: string;
    };

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;

    if (contextType === "contact" && contextId && subaccountId) {
      // Fetch contact details for context
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name, email, phone, status, tags, custom_fields, source")
        .eq("id", contextId)
        .single();

      const { data: activity } = await supabase
        .from("contact_activity")
        .select("type, summary, created_at")
        .eq("contact_id", contextId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: notes } = await supabase
        .from("contact_notes")
        .select("body, created_at")
        .eq("contact_id", contextId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (contact) {
        const activityLog = (activity || []).map((a: { type: string; summary: string | null; created_at: string }) =>
          `[${new Date(a.created_at).toLocaleDateString()}] ${a.type}: ${a.summary || "N/A"}`
        ).join("\n");

        const notesLog = (notes || []).map((n: { body: string; created_at: string }) =>
          `[${new Date(n.created_at).toLocaleDateString()}] ${n.body}`
        ).join("\n");

        systemPrompt += `\n\nYou are currently advising on this contact:\nName: ${contact.first_name} ${contact.last_name}\nEmail: ${contact.email || "N/A"}\nPhone: ${contact.phone || "N/A"}\nStatus: ${contact.status}\nTags: ${(contact.tags as string[])?.join(", ") || "none"}\nSource: ${contact.source}\n\nRecent Activity:\n${activityLog || "None"}\n\nRecent Notes:\n${notesLog || "None"}\n\nUse this context to give specific, personalized advice.`;
      }
    }

    // Build the messages array for the API call
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call the LLM (using OpenAI-compatible endpoint)
    const apiKey = process.env.OPENAI_API_KEY || process.env.ZAI_API_KEY;
    const apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      // Fallback: return a helpful message
      return NextResponse.json({
        content: "I'm here to help! However, the AI backend hasn't been configured yet. Add an OpenAI API key (or compatible LLM) to enable full AI assistance.\n\nIn the meantime, I can still help you navigate the CRM and suggest workflows.",
      });
    }

    const llmResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error("LLM API error:", errText);
      return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return NextResponse.json({ content });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
