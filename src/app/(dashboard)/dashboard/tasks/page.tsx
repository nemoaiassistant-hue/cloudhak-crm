import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export default async function TasksPage() {
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

  let tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    completed_at: string | null;
    priority: string;
  }> = [];

  if (subaccountIds.length > 0) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, due_date, completed_at, priority")
      .in("subaccount_id", subaccountIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50);

    tasks = (data || []) as typeof tasks;
  }

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-blue-100 text-blue-700",
    low: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Tasks</h1>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No tasks yet. Create tasks from contact pages or upcoming features.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center gap-3 py-3">
                {task.completed_at ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${task.completed_at ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                </div>
                {task.due_date && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(task.due_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                )}
                <Badge variant="outline" className={`capitalize text-xs ${priorityColors[task.priority] || ""}`}>
                  {task.priority}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
