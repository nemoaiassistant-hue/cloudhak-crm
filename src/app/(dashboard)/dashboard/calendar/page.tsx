import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function CalendarPage() {
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

  let events: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
    type: string;
    status: string;
  }> = [];

  if (subaccountIds.length > 0) {
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time, location, type, status")
      .in("subaccount_id", subaccountIds)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(30);

    events = (data || []) as typeof events;
  }

  const typeColors: Record<string, string> = {
    consultation: "bg-blue-100 text-blue-700",
    follow_up: "bg-purple-100 text-purple-700",
    internal: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Calendar</h1>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No upcoming events. Calendar booking management coming in Phase 2.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{event.title}</CardTitle>
                  <Badge variant="outline" className={`text-xs ${typeColors[event.type] || ""}`}>
                    {event.type.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(event.start_time).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(event.start_time).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(event.end_time).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
