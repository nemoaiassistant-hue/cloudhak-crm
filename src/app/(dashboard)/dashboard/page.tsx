import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, Calendar, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's sub-accounts
  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id")
    .eq("user_id", user!.id);

  const subaccountIds = (roles || []).map(
    (r: { subaccount_id: string }) => r.subaccount_id
  );

  // Fetch stats
  let contactCount = 0;
  let taskCount = 0;
  let upcomingCount = 0;
  let leadCount = 0;

  if (subaccountIds.length > 0) {
    const [{ count: c }, { count: t }, { count: u }, { count: l }] =
      await Promise.all([
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .in("subaccount_id", subaccountIds),
        supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .in("subaccount_id", subaccountIds)
          .is("completed_at", null),
        supabase
          .from("calendar_events")
          .select("*", { count: "exact", head: true })
          .in("subaccount_id", subaccountIds)
          .gte("start_time", new Date().toISOString()),
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .in("subaccount_id", subaccountIds)
          .eq("status", "lead"),
      ]);

    contactCount = c || 0;
    taskCount = t || 0;
    upcomingCount = u || 0;
    leadCount = l || 0;
  }

  const stats = [
    {
      label: "Total Contacts",
      value: contactCount,
      icon: Users,
      color: "text-blue-600",
    },
    {
      label: "Active Leads",
      value: leadCount,
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      label: "Open Tasks",
      value: taskCount,
      icon: CheckSquare,
      color: "text-orange-600",
    },
    {
      label: "Upcoming Events",
      value: upcomingCount,
      icon: Calendar,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {subaccountIds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Welcome! You don&apos;t have any workspaces yet.
              <br />
              Go to Settings to create your first sub-account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity feed coming in Phase 2
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
