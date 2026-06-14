import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/pipelines/kanban-board";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function PipelineBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, name, subaccount_id")
    .eq("id", id)
    .single();

  if (!pipeline) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Pipeline not found.</p>
        <Link href="/dashboard/pipelines">
          <Button variant="link">← Back to pipelines</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/dashboard/pipelines" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Pipelines
          </Link>
        </div>
        <h1 className="text-xl font-bold">{pipeline.name}</h1>
      </div>
      <div className="flex-1 px-6 py-4">
        <KanbanBoard pipelineId={pipeline.id} subaccountId={pipeline.subaccount_id} />
      </div>
    </div>
  );
}
