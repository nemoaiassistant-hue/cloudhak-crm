"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Loader2, MessageSquare, Mail, MessageCircle } from "lucide-react";

interface Conversation {
  id: string;
  channel: string;
  unread_count: number;
  last_message_at: string | null;
  contact_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  last_message: string;
}

interface Message {
  id: string;
  direction: string;
  body: string;
  status: string;
  created_at: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
};

const CHANNEL_COLORS: Record<string, string> = {
  sms: "bg-blue-500",
  email: "bg-purple-500",
  whatsapp: "bg-green-500",
};

export function Inbox({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data: convs } = await supabase
      .from("conversations")
      .select(`
        id, channel, unread_count, last_message_at, contact_id,
        contacts!inner(first_name, last_name, email, phone)
      `)
      .eq("subaccount_id", subaccountId)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    // Fetch last message preview for each conversation
    const enriched = await Promise.all(
      (convs || []).map(async (c: Record<string, unknown>) => {
        const contact = c.contacts as Record<string, string | null>;
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("body")
          .eq("conversation_id", c.id as string)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          id: c.id as string,
          channel: c.channel as string,
          unread_count: c.unread_count as number,
          last_message_at: c.last_message_at as string | null,
          contact_id: c.contact_id as string,
          contact_name: `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim(),
          contact_email: contact?.email || null,
          contact_phone: contact?.phone || null,
          last_message: (lastMsg as { body?: string })?.body || "",
        };
      })
    );

    setConversations(enriched);
    setLoading(false);
  }, [subaccountId, supabase]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel("inbox-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=in.(${conversations.map((c) => c.id).join(",")})`,
        },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversations, supabase, loadConversations]);

  const selectConversation = useCallback(async (convId: string) => {
    setSelectedId(convId);
    setLoadingMsgs(true);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, direction, body, status, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    setMessages((msgs || []) as Message[]);
    setLoadingMsgs(false);

    // Mark as read
    await supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", convId);

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
    );

    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [supabase]);

  // Realtime for selected conversation messages
  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`thread-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, supabase]);

  async function sendReply() {
    if (!reply.trim() || !selectedId) return;
    setSending(true);

    const conv = conversations.find((c) => c.id === selectedId);
    const { data: userData } = await supabase.auth.getUser();

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedId,
        direction: "outbound",
        body: reply,
        status: "sent",
      })
      .select("id, direction, body, status, created_at")
      .single();

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", selectedId);

    // Log activity on contact
    if (msg && conv) {
      await supabase.from("contact_activity").insert({
        contact_id: conv.contact_id,
        type: "message",
        summary: `Sent ${conv.channel} message: "${reply.slice(0, 80)}"`,
      });
    }

    setReply("");
    setSending(false);
    loadConversations();
  }

  const filtered = conversations.filter((c) =>
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-140px)] gap-0 rounded-lg border">
      {/* Conversation list */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet. Messages from forms, webchat, or integrations will appear here.
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                  selectedId === conv.id ? "bg-muted/70" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">
                      {conv.contact_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{conv.contact_name}</span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                          {new Date(conv.last_message_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] rounded px-1 py-0.5 text-white ${CHANNEL_COLORS[conv.channel] || "bg-gray-400"}`}>
                        {CHANNEL_ICONS[conv.channel]}
                        {conv.channel}
                      </span>
                      <p className="text-xs text-muted-foreground truncate ml-1">
                        {conv.last_message || "No messages"}
                      </p>
                    </div>
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge className="bg-primary text-[10px] h-5 min-w-5 flex items-center justify-center">
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="text-sm">
                  {selected.contact_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{selected.contact_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-white ${CHANNEL_COLORS[selected.channel] || "bg-gray-400"}`}>
                    {CHANNEL_ICONS[selected.channel]}
                    {selected.channel}
                  </span>
                  {selected.contact_email && <span>{selected.contact_email}</span>}
                  {selected.contact_phone && <span>{selected.contact_phone}</span>}
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No messages in this conversation.
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          msg.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {msg.direction === "outbound" && ` · ${msg.status}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply box */}
            <div className="border-t p-3 flex gap-2">
              <Input
                placeholder={`Reply via ${selected.channel}...`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                disabled={sending}
              />
              <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
