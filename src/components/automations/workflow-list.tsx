"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Zap, Plus, Trash2, Loader2, Play, Pause,
  MessageSquare, Tag, ArrowRight, UserPlus, FileEdit,
} from "lucide-react";
import { PermissionGate } from "@/components/rbac/permission-gate";

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
  enabled: boolean;
  trigger_config: Record<string, unknown>;
  step_count?: number;
  execution_count?: number;
}

const TRIGGER_TYPES: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  form_submit: { label: "Form Submitted", icon: <FileEdit className="h-4 w-4" />, desc: "When a form is submitted" },
  contact_created: { label: "Contact Created", icon: <UserPlus className="h-4 w-4" />, desc: "When a new contact is added" },
  stage_change: { label: "Pipeline Stage Change", icon: <ArrowRight className="h-4 w-4" />, desc: "When a deal moves stages" },
  tag_added: { label: "Tag Added", icon: <Tag className="h-4 w-4" />, desc: "When a tag is added to a contact" },
  inbound_message: { label: "Inbound Message", icon: <MessageSquare className="h-4 w-4" />, desc: "When a message is received" },
};

export function WorkflowList({ subaccountId }: { subaccountId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("form_submit");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: wfs } = await supabase
      .from("workflows")
      .select("id, name, trigger_type, enabled, trigger_config")
      .eq("subaccount_id", subaccountId)
      .order("created_at", { ascending: false });

    const enriched = await Promise.all(
      (wfs || []).map(async (wf: Record<string, unknown>) => {
        const { count: stepCount } = await supabase
          .from("workflow_steps")
          .select("id", { count: "exact", head: true })
          .eq("workflow_id", wf.id as string);
        const { count: execCount } = await supabase
          .from("workflow_executions")
          .select("id", { count: "exact", head: true })
          .eq("workflow_id", wf.id as string);
        return {
          ...wf,
          step_count: stepCount || 0,
          execution_count: execCount || 0,
        } as Workflow;
      })
    );
    setWorkflows(enriched);
    setLoading(false);
  }, [subaccountId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function createWorkflow() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("workflows")
      .insert({
        subaccount_id: subaccountId,
        name: newName,
        trigger_type: newTrigger,
        trigger_config: {},
        enabled: true,
      })
      .select("id")
      .single();

    if (!error && data) {
      setShowCreate(false);
      setNewName("");
      router.push(`/dashboard/automations/${data.id}`);
    }
    setCreating(false);
  }

  async function toggle(wf: Workflow) {
    const newVal = !wf.enabled;
    await supabase.from("workflows").update({ enabled: newVal }).eq("id", wf.id);
    setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? { ...w, enabled: newVal } : w)));
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Delete this workflow and all its steps?")) return;
    await supabase.from("workflows").delete().eq("id", id);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{workflows.length} workflow{workflows.length !== 1 ? "s" : ""}</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <PermissionGate subaccountId={subaccountId} require="automations.manage">
            <DialogTrigger>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> New Workflow
              </Button>
            </DialogTrigger>
          </PermissionGate>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Automation</DialogTitle>
              <DialogDescription>Choose a trigger to start building your workflow</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input
                  placeholder="e.g. New Lead Welcome Sequence"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select value={newTrigger} onValueChange={(v: string | null) => v && setNewTrigger(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_TYPES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_TYPES[newTrigger]?.desc}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createWorkflow} disabled={creating}>
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
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Zap className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">No automations yet. Create one to automate repetitive tasks.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <Card key={wf.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex flex-1 items-center gap-3 cursor-pointer"
                    onClick={() => router.push(`/dashboard/automations/${wf.id}`)}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${wf.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {TRIGGER_TYPES[wf.trigger_type]?.icon || <Zap className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{wf.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {TRIGGER_TYPES[wf.trigger_type]?.label || wf.trigger_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {wf.step_count} step{wf.step_count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {wf.execution_count} run{wf.execution_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {wf.enabled ? (
                        <Badge className="bg-green-500 text-xs"><Play className="mr-0.5 h-3 w-3" /> Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs"><Pause className="mr-0.5 h-3 w-3" /> Paused</Badge>
                      )}
                      <PermissionGate subaccountId={subaccountId} require="automations.manage">
                        <Switch checked={wf.enabled} onCheckedChange={() => toggle(wf)} />
                      </PermissionGate>
                    </div>
                    <PermissionGate subaccountId={subaccountId} require="automations.manage">
                      <Button variant="ghost" size="icon" onClick={() => deleteWorkflow(wf.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
