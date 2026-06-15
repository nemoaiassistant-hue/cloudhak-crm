import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readTools, readToolMap } from "@/lib/ai/tools/read-tools";
import { writeTools, writeToolMap } from "@/lib/ai/tools/write-tools";
import { advancedTools, advancedToolMap } from "@/lib/ai/tools/advanced-tools";
import { toToolDefinition } from "@/lib/ai/tools/types";
import type { ToolContext, CrmTool } from "@/lib/ai/tools/types";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TOOL_ROUNDS = 6;

// Combined tool registry — all 30 tools (12 read + 10 write + 8 advanced)
const allTools: CrmTool[] = [...readTools, ...writeTools, ...advancedTools];
const allToolMap: Record<string, CrmTool> = Object.fromEntries(allTools.map((t) => [t.name, t]));

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

  // Build tool definitions — filter out write tools for viewers
  const canWrite = role !== "viewer";
  const availableTools = canWrite ? allTools : [...readTools, ...advancedTools.filter((t) => !t.requiresConfirmation)];
  const toolDefs = availableTools.map(toToolDefinition);

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    role,
    subaccountName: subAccount?.name,
    pageContext: contextType,
    toolNames: availableTools.map((t) => t.name),
    hasWriteAccess: canWrite,
  });

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const apiMessages: Array<Record<string, unknown>> = [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        const apiKey = process.env.OPENAI_API_KEY || process.env.ZAI_API_KEY;
        const apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

        if (!apiKey) {
          sendEvent("text", "⚠️ **AI backend not configured.**\n\nAdd an `OPENAI_API_KEY` environment variable to activate the co-pilot.");
          sendEvent("done", {});
          controller.close();
          return;
        }

        let round = 0;
        let finalText = "";
        let pendingActionCard: { name: string; params: Record<string, unknown> } | null = null;

        while (round < MAX_TOOL_ROUNDS) {
          round++;

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

          // If the LLM wants to call tools
          if (message?.tool_calls && message.tool_calls.length > 0) {
            // Add assistant message with tool calls to conversation
            apiMessages.push({
              role: "assistant",
              content: message.content || "",
              tool_calls: message.tool_calls,
            });

            // Process each tool call
            let blockedByConfirmation = false;

            for (const tc of message.tool_calls) {
              const toolName = tc.function.name;
              const toolArgs = JSON.parse(tc.function.arguments || "{}");
              const tool = allToolMap[toolName];

              if (!tool) {
                sendEvent("tool_start", { name: toolName, args: toolArgs });
                sendEvent("tool_end", { name: toolName, success: false });
                apiMessages.push({ role: "tool", content: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }), tool_call_id: tc.id });
                continue;
              }

              // Check if this is a confirmation-required write tool
              if (tool.requiresConfirmation) {
                // Send action card to client — DON'T execute
                sendEvent("action_card", { name: toolName, params: toolArgs, call_id: tc.id });

                // Tell the LLM this needs user confirmation
                apiMessages.push({
                  role: "tool",
                  content: JSON.stringify({
                    success: false,
                    error: "This action requires user confirmation. An action card has been shown to the user. They will confirm or cancel it separately.",
                    pending_confirmation: true,
                  }),
                  tool_call_id: tc.id,
                });

                pendingActionCard = { name: toolName, params: toolArgs };
                blockedByConfirmation = true;
                continue;
              }

              // Execute non-confirmation tools immediately
              sendEvent("tool_start", { name: toolName, args: toolArgs });

              let result;
              try {
                result = await tool.execute(toolArgs, toolCtx);
              } catch (err) {
                result = { success: false, error: String(err) };
              }

              sendEvent("tool_end", { name: toolName, success: result.success });
              apiMessages.push({ role: "tool", content: JSON.stringify(result), tool_call_id: tc.id });
            }

            // If we have a pending confirmation, stop the loop and let LLM explain
            if (blockedByConfirmation) {
              // Let the LLM generate a brief "I need your confirmation" message
              const confirmResponse = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                  model,
                  messages: apiMessages,
                  max_tokens: 200,
                  temperature: 0.5,
                }),
              });

              if (confirmResponse.ok) {
                const confirmData = await confirmResponse.json();
                finalText = confirmData.choices?.[0]?.message?.content || "";
              } else {
                finalText = "I've prepared an action that needs your confirmation. Please review and confirm it below.";
              }
              break;
            }

            // Continue the tool loop
            continue;
          }

          // No tool calls — this is the final response
          finalText = message?.content || "I couldn't generate a response.";
          break;
        }

        // Stream the final text
        if (finalText) {
          const words = finalText.split(/(\s+)/);
          for (const word of words) {
            sendEvent("text", word);
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
