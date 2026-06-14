import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WorkflowBuilder } from "@/components/automations/workflow-builder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: workflow } = await supabase
    .from("workflows")
    .select("id, name, trigger_type, enabled")
    .eq("id", id)
    .single();

  if (!workflow) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Workflow not found.</p>
        <Link href="/dashboard/automations"><Button variant="link">← Back</Button></Link>
      </div>
    );
  }

  // Get recent executions
  const { data: executions } = await supabase
    .from("workflow_executions")
    .select("id, status, current_step, started_at, completed_at")
    .eq("workflow_id", id)
    .order("started_at", { ascending: false })
    .limit(10);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/dashboard/automations" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Automations
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{workflow.name}</h1>
          {workflow.enabled ? (
            <Badge className="bg-green-500">Active</Badge>
          ) : (
            <Badge variant="secondary">Paused</Badge>
          )}
        </div>
      </div>

      <WorkflowBuilder
        workflowId={workflow.id}
        workflowName={workflow.name}
        triggerType={workflow.trigger_type}
      />

      {/* Execution History */}
      {executions && executions.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 font-semibold">Recent Executions</h3>
          <div className="space-y-2">
            {executions.map((exec: { id: string; status: string; current_step: number; started_at: string; completed_at: string | null }) => (
              <div key={exec.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {exec.status === "completed" && <Badge className="bg-green-500 text-xs">Completed</Badge>}
                  {exec.status === "running" && <Badge className="bg-blue-500 text-xs">Running</Badge>}
                  {exec.status === "failed" && <Badge variant="destructive" className="text-xs">Failed</Badge>}
                  <span className="text-muted-foreground">Step {exec.current_step}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(exec.started_at).toLocaleString("en-GB")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
