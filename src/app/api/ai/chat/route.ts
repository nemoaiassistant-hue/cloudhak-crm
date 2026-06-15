import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readTools, readToolMap } from "@/lib/ai/tools/read-tools";
import { toToolDefinition } from "@/lib/ai/tools/types";
import type { ToolContext } from "@/lib/ai/tools/types";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

export const runtime = "nodejs"; // Need Supabase SSR client (not edge)
export const maxDuration = 30;

const MAX_TOOL_ROUNDS = 5; // Prevent infinite loops

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const body = await req.json();
  const { messages, contextType, contextId, subaccountId } = body as {
    messages: Array<{ role: string; content: string }>;
    contextType?: string;
    contextId?: string;
    subaccountId?: string;
  };

  if (!subaccountId) {
    return new Response(JSON.stringify({ error: "Sub-account ID required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Get user's role and org
  const { data: roleData } = await supabase
    .from("user_subaccount_roles")
    .select("role, sub_accounts(id, name, org_id)")
    .eq("subaccount_id", subaccountId)
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role || "staff";
  const saData = roleData?.sub_accounts as unknown as Array<{ id: string; name: string; org_id: string }> | undefined;
  const subAccount = saData?.[0] || null;

  const toolCtx: ToolContext = {
    supabase: supabase as unknown as import("@supabase/supabase-js").SupabaseClient,
    userId: user.id,
    subaccountId,
    role,
    orgId: subAccount?.org_id,
  };

  // Build tool definitions for the LLM
  const toolDefs = readTools.map(toToolDefinition);

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    role,
    subaccountName: subAccount?.name,
    pageContext: contextType,
    toolNames: readTools.map((t) => t.name),
  });

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Build conversation messages for the LLM
        const apiMessages: Array<{ role: string; content: string }> = [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        // Get LLM config
        const apiKey = process.env.OPENAI_API_KEY || process.env.ZAI_API_KEY;
        const apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

        if (!apiKey) {
          sendEvent("text", "⚠️ **AI backend not configured.**\n\nAdd an `OPENAI_API_KEY` environment variable in Vercel to activate the co-pilot.\n\nOnce configured, I'll be able to search your contacts, analyze pipelines, find stale leads, and much more.");
          controller.close();
          return;
        }

        let round = 0;
        let finalText = "";

        while (round < MAX_TOOL_ROUNDS) {
          round++;

          // Call LLM
          const llmResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: apiMessages,
              tools: toolDefs,
              tool_choice: "auto",
              max_tokens: 1200,
              temperature: 0.7,
            }),
          });

          if (!llmResponse.ok) {
            const errText = await llmResponse.text();
            console.error("LLM API error:", errText);
            sendEvent("error", "AI service unavailable. Please try again.");
            break;
          }

          const llmData = await llmResponse.json();
          const choice = llmData.choices?.[0];
          const message = choice?.message;
          const finishReason = choice?.finish_reason;

          // If the LLM wants to call tools
          if (message?.tool_calls && message.tool_calls.length > 0) {
            // Add the assistant message with tool calls to conversation
            apiMessages.push({
              role: "assistant",
              content: message.content || "",
              // Store tool calls for the next round
              ...({ tool_calls: message.tool_calls } as Record<string, unknown>),
            } as { role: string; content: string });

            // Execute each tool call
            for (const tc of message.tool_calls) {
              const toolName = tc.function.name;
              const toolArgs = JSON.parse(tc.function.arguments || "{}");

              // Notify the client
              sendEvent("tool_start", { name: toolName, args: toolArgs });

              const tool = readToolMap[toolName];
              let result;
              if (!tool) {
                result = { success: false, error: `Unknown tool: ${toolName}` };
              } else {
                try {
                  result = await tool.execute(toolArgs, toolCtx);
                } catch (err) {
                  result = { success: false, error: String(err) };
                }
              }

              sendEvent("tool_end", { name: toolName, success: result.success });

              // Add tool result to conversation
              apiMessages.push({
                role: "tool",
                content: JSON.stringify(result),
                ...({ tool_call_id: tc.id } as Record<string, unknown>),
              } as { role: string; content: string });
            }

            // Loop back to let the LLM process tool results
            continue;
          }

          // No tool calls — this is the final response
          finalText = message?.content || "I couldn't generate a response.";
          break;
        }

        // Stream the final text in chunks (simulated streaming for non-streaming API)
        if (finalText) {
          // Try real streaming if the API supports it
          const words = finalText.split(/(\s+)/);
          for (const word of words) {
            sendEvent("text", word);
            // Small delay for streaming effect
            if (word.trim()) await new Promise((r) => setTimeout(r, 8));
          }
        } else if (round >= MAX_TOOL_ROUNDS) {
          sendEvent("text", "I processed your request but reached the tool call limit. Please try a more specific question.");
        }

        sendEvent("done", {});
        controller.close();
      } catch (error) {
        console.error("AI chat stream error:", error);
        sendEvent("error", "Internal error occurred.");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
