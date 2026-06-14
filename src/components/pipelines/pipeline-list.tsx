"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Trash2, Loader2, TrendingUp, ArrowRight } from "lucide-react";
import { PermissionGate } from "@/components/rbac/permission-gate";

interface Pipeline {
  id: string;
  name: string;
  sort_order: number;
  stage_count?: number;
  opportunity_count?: number;
  total_value?: number;
}

export function PipelineList({ subaccountId }: { subaccountId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pipelines")
      .select("id, name, sort_order")
      .eq("subaccount_id", subaccountId)
      .order("sort_order", { ascending: true });

    const pipelines = (data || []) as Pipeline[];

    // Get stage counts and opportunity stats
    for (const p of pipelines) {
      const [{ data: stages }, { data: opps }] = await Promise.all([
        supabase.from("pipeline_stages").select("id").eq("pipeline_id", p.id),
        supabase
          .from("opportunities")
          .select("value")
          .eq("pipeline_id", p.id),
      ]);
      p.stage_count = stages?.length || 0;
      p.opportunity_count = opps?.length || 0;
      p.total_value = opps?.reduce((sum, o) => sum + Number(o.value), 0) || 0;
    }

    setPipelines(pipelines);
    setLoading(false);
  }, [subaccountId, supabase]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  async function createPipeline() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        subaccount_id: subaccountId,
        name: newName,
        sort_order: pipelines.length,
      })
      .select("id")
      .single();

    if (!error && data) {
      // Create default stages
      const defaultStages = [
        { name: "New Lead", probability: 10, color: "#94a3b8", sort_order: 0 },
        { name: "Contacted", probability: 25, color: "#3b82f6", sort_order: 1 },
        { name: "Qualified", probability: 50, color: "#8b5cf6", sort_order: 2 },
        { name: "Proposal", probability: 75, color: "#f59e0b", sort_order: 3 },
        { name: "Won", probability: 100, color: "#22c55e", sort_order: 4 },
        { name: "Lost", probability: 0, color: "#ef4444", sort_order: 5 },
      ];

      await supabase.from("pipeline_stages").insert(
        defaultStages.map((s) => ({ ...s, pipeline_id: data.id }))
      );

      setShowCreate(false);
      setNewName("");
      router.push(`/dashboard/pipelines/${data.id}`);
    }
    setCreating(false);
  }

  async function deletePipeline(id: string) {
    if (!confirm("Delete this pipeline and all its opportunities?")) return;
    await supabase.from("pipelines").delete().eq("id", id);
    setPipelines((prev) => prev.filter((p) => p.id !== id));
  }

  const fmtGBP = (v: number) =>
    v.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pipelines.length} pipeline{pipelines.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <PermissionGate subaccountId={subaccountId} require="pipelines.manage">
            <DialogTrigger>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> New Pipeline
              </Button>
            </DialogTrigger>
          </PermissionGate>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Pipeline</DialogTitle>
              <DialogDescription>
                A new pipeline comes with default stages: New Lead → Contacted → Qualified → Proposal → Won → Lost
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="pipeName">Pipeline Name</Label>
                <Input
                  id="pipeName"
                  placeholder="e.g. Sales Pipeline, Patient Intake"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPipeline()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createPipeline} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pipelines.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Filter className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">
              No pipelines yet. Create your first one to start tracking deals.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/dashboard/pipelines/${p.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    {p.name}
                  </CardTitle>
                  <PermissionGate subaccountId={subaccountId} require="pipelines.manage">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePipeline(p.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </PermissionGate>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">
                      {p.stage_count} stages • {p.opportunity_count} deals
                    </p>
                    {p.total_value && p.total_value > 0 ? (
                      <p className="text-lg font-bold text-green-600">{fmtGBP(p.total_value)}</p>
                    ) : (
                      <p className="text-lg font-bold text-muted-foreground">£0</p>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
