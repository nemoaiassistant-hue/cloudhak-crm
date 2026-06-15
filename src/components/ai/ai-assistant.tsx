"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, X, Bot, User, CheckCircle2, AlertCircle, ShieldCheck, Loader2 as Spinner } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: Array<{ name: string; success: boolean }>;
  actionCard?: {
    name: string;
    params: Record<string, unknown>;
    status: "pending" | "confirmed" | "executing" | "done" | "cancelled" | "error";
    result?: string;
  };
}

interface ToolStatus {
  name: string;
  status: "running" | "done" | "error";
}

// Human-readable action labels
const ACTION_LABELS: Record<string, string> = {
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

// Format action params for display
function formatActionParams(name: string, params: Record<string, unknown>): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const [key, val] of Object.entries(params)) {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    let value: string;
    if (Array.isArray(val)) {
      value = val.join(", ");
    } else if (typeof val === "object" && val !== null) {
      value = JSON.stringify(val);
    } else {
      value = String(val);
    }
    // Truncate long values
    if (value.length > 120) value = value.slice(0, 117) + "...";
    rows.push({ label, value });
  }
  return rows;
}

interface AIAssistantProps {
  contextType?: string;
  contextId?: string;
  subaccountId?: string;
}

// ─── Minimal Markdown renderer (tables, bold, lists, links) ───
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (listItems.length > 0) {
      if (listType === "ol") {
        elements.push(<ol key={`ol-${elements.length}`} className="list-decimal pl-4 space-y-1 my-1">{listItems}</ol>);
      } else {
        elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-4 space-y-1 my-1">{listItems}</ul>);
      }
      listItems = [];
      listType = null;
    }
  }

  function flushTable() {
    if (tableRows.length > 0) {
      const [header, ...body] = tableRows;
      elements.push(
        <div key={`tbl-${elements.length}`} className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                {header.map((h, i) => (
                  <th key={i} className="text-left font-semibold px-2 py-1">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  }

  function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="bg-muted px-1 py-0.5 rounded text-[11px]">{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  for (const line of lines) {
    if (line.includes("|") && line.trim().startsWith("|")) {
      if (/^\|[\s-|]+\|?$/.test(line.trim())) continue;
      inTable = true;
      tableRows.push(line.split("|").slice(1, line.trim().endsWith("|") ? -1 : undefined).map((c) => c.trim()));
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      const isOrdered = /^\s*\d+\.\s/.test(line);
      if (listType && listType !== (isOrdered ? "ol" : "ul")) flushList();
      listType = isOrdered ? "ol" : "ul";
      const content = line.replace(/^\s*[-*]\s|^\s*\d+\.\s/, "");
      listItems.push(<li key={`li-${listItems.length}`}>{renderInline(content)}</li>);
      continue;
    } else if (listType) {
      flushList();
    }

    if (!line.trim()) {
      elements.push(<div key={`br-${elements.length}`} className="h-2" />);
      continue;
    }

    elements.push(<p key={`p-${elements.length}`} className="my-0.5 leading-relaxed">{renderInline(line)}</p>);
  }

  flushList();
  flushTable();
  return elements;
}

// ─── Action Card Component ───
function ActionCard({
  card,
  onConfirm,
  onCancel,
}: {
  card: NonNullable<ChatMessage["actionCard"]>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const params = formatActionParams(card.name, card.params);
  const label = ACTION_LABELS[card.name] || card.name;

  return (
    <div className={cn(
      "rounded-lg border-2 overflow-hidden mt-2",
      card.status === "pending" && "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20",
      card.status === "confirmed" && "border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/20",
      card.status === "done" && "border-green-400/50 bg-green-50/50 dark:bg-green-950/20",
      card.status === "error" && "border-red-400/50 bg-red-50/50 dark:bg-red-950/20",
      card.status === "cancelled" && "border-gray-300 bg-muted/30",
      card.status === "executing" && "border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/20",
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-current/10">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold flex-1">{label}</span>
        {card.status === "pending" && <Badge variant="outline" className="text-amber-600 border-amber-400">Action Needed</Badge>}
        {card.status === "executing" && <Badge variant="outline" className="text-blue-600 border-blue-400"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>}
        {card.status === "done" && <Badge variant="outline" className="text-green-600 border-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>}
        {card.status === "error" && <Badge variant="outline" className="text-red-600 border-red-400"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>}
        {card.status === "cancelled" && <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>}
      </div>

      {/* Params */}
      <div className="px-3 py-2 space-y-1">
        {params.map((p, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-muted-foreground font-medium min-w-[80px] shrink-0">{p.label}:</span>
            <span className="break-words">{p.value}</span>
          </div>
        ))}
      </div>

      {/* Result message */}
      {card.result && (
        <div className="px-3 pb-2 text-xs">
          <p className={cn(
            "font-medium",
            card.status === "done" && "text-green-600",
            card.status === "error" && "text-red-600",
          )}>{card.result}</p>
        </div>
      )}

      {/* Buttons */}
      {(card.status === "pending") && (
        <div className="flex gap-2 px-3 py-2 border-t border-current/10">
          <Button size="sm" className="h-7 text-xs flex-1" onClick={onConfirm}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  search_contacts: "Searching contacts",
  get_contact_details: "Fetching contact details",
  list_contacts_by_status: "Listing contacts",
  get_pipeline_summary: "Analyzing pipeline",
  get_pipeline_deals: "Fetching deals",
  get_tasks: "Checking tasks",
  get_calendar_today: "Checking calendar",
  get_dashboard_stats: "Gathering stats",
  get_form_submissions: "Checking forms",
  get_conversations: "Checking inbox",
  get_client_overview: "Loading agency overview",
  get_stale_contacts: "Finding stale contacts",
  create_task: "Creating task",
  update_task_status: "Updating task",
  update_contact_status: "Updating status",
  add_contact_tag: "Updating tags",
  add_contact_note: "Adding note",
  move_deal_stage: "Preparing deal move",
  create_contact: "Preparing contact",
  send_email: "Preparing email",
  send_sms: "Preparing SMS",
  bulk_update_tags: "Preparing bulk tag",
};

export function AIAssistant({ contextType, contextId, subaccountId }: AIAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, toolStatuses]);

  // Execute a confirmed action via the tools API
  const executeAction = useCallback(async (msgIndex: number, toolName: string, params: Record<string, unknown>) => {
    // Update status to executing
    setMessages((prev) => {
      const updated = [...prev];
      if (updated[msgIndex]?.actionCard) {
        updated[msgIndex]!.actionCard!.status = "executing";
      }
      return updated;
    });

    try {
      const res = await fetch("/api/ai/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName, params, subaccountId }),
      });
      const data = await res.json();

      setMessages((prev) => {
        const updated = [...prev];
        if (updated[msgIndex]?.actionCard) {
          if (data.success) {
            updated[msgIndex]!.actionCard!.status = "done";
            updated[msgIndex]!.actionCard!.result = "✅ Action completed successfully.";
          } else {
            updated[msgIndex]!.actionCard!.status = "error";
            updated[msgIndex]!.actionCard!.result = `❌ ${data.error || "Action failed."}`;
          }
        }
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[msgIndex]?.actionCard) {
          updated[msgIndex]!.actionCard!.status = "error";
          updated[msgIndex]!.actionCard!.result = "❌ Connection error.";
        }
        return updated;
      });
    }
  }, [subaccountId]);

  const cancelAction = useCallback((msgIndex: number) => {
    setMessages((prev) => {
      const updated = [...prev];
      if (updated[msgIndex]?.actionCard) {
        updated[msgIndex]!.actionCard!.status = "cancelled";
        updated[msgIndex]!.actionCard!.result = "Cancelled by user.";
      }
      return updated;
    });
  }, []);

  const send = useCallback(async function send() {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setToolStatuses([]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          contextType,
          contextId,
          subaccountId,
        }),
      });

      if (!res.ok) {
        setMessages([...newMessages, { role: "assistant", content: "⚠️ Connection error. Please try again." }]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const toolsTracker: Array<{ name: string; success: boolean }> = [];
      let started = false;
      let pendingActionCard: ChatMessage["actionCard"] = undefined;

      if (!reader) {
        setMessages([...newMessages, { role: "assistant", content: "⚠️ Stream error." }]);
        setLoading(false);
        return;
      }

      // Create placeholder message
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === "tool_start") {
                started = true;
                setToolStatuses((prev) => [...prev, { name: data.name, status: "running" }]);
              } else if (currentEvent === "tool_end") {
                setToolStatuses((prev) =>
                  prev.map((t) =>
                    t.name === data.name && t.status === "running"
                      ? { name: data.name, status: data.success ? "done" : "error" }
                      : t
                  )
                );
                toolsTracker.push({ name: data.name, success: data.success });
              } else if (currentEvent === "action_card") {
                pendingActionCard = {
                  name: data.name as string,
                  params: data.params as Record<string, unknown>,
                  status: "pending" as const,
                };
              } else if (currentEvent === "text") {
                assistantText += data;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                    toolsUsed: toolsTracker.length > 0 ? toolsTracker : undefined,
                    actionCard: pendingActionCard || undefined,
                  };
                  return updated;
                });
              } else if (currentEvent === "done") {
                // Finished
              } else if (currentEvent === "error") {
                assistantText = `⚠️ ${data}`;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantText };
                  return updated;
                });
              }
            } catch {
              // Ignore parse errors
            }
            currentEvent = "";
          }
        }
      }

      if (!assistantText && !started && !pendingActionCard) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "I couldn't process that. Please try again." };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Connection error. Please try again." }]);
    } finally {
      setLoading(false);
      setToolStatuses([]);
    }
  }, [input, loading, messages, contextType, contextId, subaccountId]);

  const suggestions =
    contextType === "contact"
      ? [
          "Summarize this contact's engagement",
          "Create a follow-up task for them",
          "Add a note about the last call",
        ]
      : [
          "How many leads do we have?",
          "Create a task to call hot leads",
          "Show me stale contacts (30+ days)",
          "What's the pipeline value?",
        ];

  return (
    <>
      {/* Floating button */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 p-0 animate-in fade-in duration-300"
          size="icon"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[440px] max-w-[100vw] h-[100dvh] sm:h-[640px] sm:max-h-[calc(100vh-3rem)] bg-background sm:rounded-xl sm:border sm:shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Co-Pilot</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-muted-foreground">Can read & take actions</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium mb-1">AI Co-Pilot</p>
                <p className="text-xs text-muted-foreground mb-4">
                  I can search contacts, manage tasks, move deals, and take actions for you.
                </p>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-xs rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  msg.role === "user" ? "bg-primary/10" : "bg-muted"
                )}>
                  {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {/* Tool usage badges */}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5 pb-1.5 border-b border-border/50">
                      {msg.toolsUsed.map((t, ti) => (
                        <Badge key={ti} variant="outline" className="text-[9px] gap-1 py-0 h-4">
                          {t.success ? <CheckCircle2 className="h-2.5 w-2.5 text-green-500" /> : <AlertCircle className="h-2.5 w-2.5 text-red-500" />}
                          {t.name.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {msg.content && (
                    <div className="whitespace-pre-wrap break-words">
                      {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                    </div>
                  )}
                  {/* Action Card */}
                  {msg.actionCard && (
                    <ActionCard
                      card={msg.actionCard}
                      onConfirm={() => msg.actionCard && executeAction(i, msg.actionCard.name, msg.actionCard.params)}
                      onCancel={() => cancelAction(i)}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Loading state */}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2 min-w-[120px]">
                  {toolStatuses.length > 0 ? (
                    <div className="space-y-1.5">
                      {toolStatuses.map((ts, ti) => (
                        <div key={ti} className="flex items-center gap-2 text-xs">
                          {ts.status === "running" ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          ) : ts.status === "done" ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span className="text-muted-foreground">
                            {TOOL_LABELS[ts.name] || ts.name}...
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder="Ask me to search, create, or manage..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={loading}
              className="text-sm"
            />
            <Button onClick={send} disabled={loading || !input.trim()} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
