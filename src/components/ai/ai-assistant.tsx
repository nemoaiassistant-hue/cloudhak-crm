"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, X, Bot, User, Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: Array<{ name: string; success: boolean }>;
}

interface ToolStatus {
  name: string;
  status: "running" | "done" | "error";
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
    // Bold **text**
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
    // Table detection
    if (line.includes("|") && line.trim().startsWith("|")) {
      // Skip separator rows (|---|---|)
      if (/^\|[\s-|]+\|?$/.test(line.trim())) continue;
      inTable = true;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      // Handle trailing |
      if (line.trim().endsWith("|")) {
        tableRows.push(line.split("|").slice(1, -1).map((c) => c.trim()));
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List items
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      const isOrdered = /^\s*\d+\.\s/.test(line);
      if (listType && listType !== (isOrdered ? "ol" : "ul")) {
        flushList();
      }
      listType = isOrdered ? "ol" : "ul";
      const content = line.replace(/^\s*[-*]\s|^\s*\d+\.\s/, "");
      listItems.push(<li key={`li-${listItems.length}`}>{renderInline(content)}</li>);
      continue;
    } else if (listType) {
      flushList();
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`br-${elements.length}`} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`p-${elements.length}`} className="my-0.5 leading-relaxed">{renderInline(line)}</p>);
  }

  flushList();
  flushTable();

  return elements;
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

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const toolsTracker: Array<{ name: string; success: boolean }> = [];
      let started = false;

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
              } else if (currentEvent === "text") {
                assistantText += data;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                    toolsUsed: toolsTracker.length > 0 ? toolsTracker : undefined,
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
              // Ignore parse errors for partial data
            }
            currentEvent = "";
          }
        }
      }

      // Final cleanup
      if (!assistantText && !started) {
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
          "Draft a follow-up email",
          "What are the next best actions?",
        ]
      : [
          "How many leads do we have this week?",
          "Show me stale contacts (30+ days)",
          "What's the pipeline value?",
          "Any overdue tasks?",
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
                  <span className="text-[10px] text-muted-foreground">Connected to your data</span>
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
                  I can search your contacts, analyze pipelines, find stale leads, and more.
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
                  <div className="whitespace-pre-wrap break-words">
                    {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading state with tool statuses */}
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
              placeholder="Ask me anything about your CRM..."
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
