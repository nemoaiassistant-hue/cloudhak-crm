import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mail, Smartphone } from "lucide-react";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id")
    .eq("user_id", user!.id);

  const subaccountIds = (roles || []).map(
    (r: { subaccount_id: string }) => r.subaccount_id
  );

  let conversations: Array<{
    id: string;
    channel: string;
    unread_count: number;
    last_message_at: string | null;
    contact_id: string;
  }> = [];

  if (subaccountIds.length > 0) {
    const { data } = await supabase
      .from("conversations")
      .select("id, channel, unread_count, last_message_at, contact_id")
      .in("subaccount_id", subaccountIds)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);

    conversations = (data || []) as typeof conversations;
  }

  const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    sms: Smartphone,
    email: Mail,
    whatsapp: MessageSquare,
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unified Inbox</h1>
        {totalUnread > 0 && (
          <Badge variant="destructive">{totalUnread} unread</Badge>
        )}
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No conversations yet. SMS, email, and WhatsApp integration coming in Phase 3.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const Icon = channelIcons[conv.channel] || MessageSquare;
            return (
              <Card key={conv.id} className="cursor-pointer hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="rounded-full bg-muted p-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Conversation</p>
                    <p className="text-sm text-muted-foreground capitalize">{conv.channel}</p>
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge variant="destructive">{conv.unread_count}</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
