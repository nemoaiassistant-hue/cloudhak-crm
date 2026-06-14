"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Save, Loader2, ArrowDown, Clock,
  Mail, MessageSquare, Tag, Webhook, ArrowRight, Zap,
} from "lucide-react";

interface Step {
  id?: string;
  type: string;
  config: Record<string, string>;
  sort_order: number;
  delay_minutes: number;
}

const STEP_TYPES: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  send_email: { label: "Send Email", icon: <Mail className="h-4 w-4" />, color: "bg-purple-500", desc: "Send an email to the contact" },
  send_sms: { label: "Send SMS", icon: <MessageSquare className="h-4 w-4" />, color: "bg-blue-500", desc: "Send a text message" },
  add_tag: { label: "Add Tag", icon: <Tag className="h-4 w-4" />, color: "bg-orange-500", desc: "Tag the contact" },
  remove_tag: { label: "Remove Tag", icon: <Tag className="h-4 w-4" />, color: "bg-gray-500", desc: "Remove a tag from contact" },
  move_stage: { label: "Move Pipeline Stage", icon: <ArrowRight className="h-4 w-4" />, color: "bg-green-500", desc: "Move deal to another stage" },
  webhook: { label: "Call Webhook", icon: <Webhook className="h-4 w-4" />, color: "bg-indigo-500", desc: "POST to an external URL" },
};

export function WorkflowBuilder({
  workflowId,
  triggerType,
}: {
  workflowId: string;
  workflowName: string;
  triggerType: string;
}) {
  const supabase = createClient();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newStepType, setNewStepType] = useState("send_email");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: existing } = await supabase
      .from("workflow_steps")
      .select("id, type, config, sort_order, delay_minutes")
      .eq("workflow_id", workflowId)
      .order("sort_order", { ascending: true });

    setSteps((existing || []) as Step[]);
    setLoading(false);
  }, [workflowId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function addStep() {
    const newStep: Step = {
      type: newStepType,
      config: {},
      sort_order: steps.length,
      delay_minutes: 0,
    };
    setSteps([...steps, newStep]);
    setShowAdd(false);
  }

  function updateStep(index: number, updates: Partial<Step>) {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }

  function updateStepConfig(index: number, key: string, value: string) {
    setSteps(steps.map((s, i) => (i === index ? { ...s, config: { ...s.config, [key]: value } } : s)));
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    // Re-index sort_order
    newSteps.forEach((s, i) => (s.sort_order = i));
    setSteps(newSteps);
  }

  async function save() {
    setSaving(true);

    // Delete existing steps, then re-insert (simpler than diffing)
    await supabase.from("workflow_steps").delete().eq("workflow_id", workflowId);

    if (steps.length > 0) {
      const inserts = steps.map((s, i) => ({
        workflow_id: workflowId,
        type: s.type,
        config: s.config,
        sort_order: i,
        delay_minutes: s.delay_minutes || 0,
      }));
      await supabase.from("workflow_steps").insert(inserts);
    }

    // Reload to get IDs
    load();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function renderStepConfig(step: Step, index: number) {
    switch (step.type) {
      case "send_email":
        return (
          <div className="space-y-2 mt-2">
            <Input
              placeholder="Subject"
              value={step.config.subject || ""}
              onChange={(e) => updateStepConfig(index, "subject", e.target.value)}
              className="text-sm"
            />
            <Textarea
              placeholder="Email body..."
              value={step.config.body || ""}
              onChange={(e) => updateStepConfig(index, "body", e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
        );
      case "send_sms":
        return (
          <Textarea
            placeholder="SMS message..."
            value={step.config.body || ""}
            onChange={(e) => updateStepConfig(index, "body", e.target.value)}
            rows={2}
            className="text-sm mt-2"
          />
        );
      case "add_tag":
      case "remove_tag":
        return (
          <Input
            placeholder="Tag name"
            value={step.config.tag || ""}
            onChange={(e) => updateStepConfig(index, "tag", e.target.value)}
            className="text-sm mt-2"
          />
        );
      case "move_stage":
        return (
          <Input
            placeholder="Stage ID or name"
            value={step.config.stage || ""}
            onChange={(e) => updateStepConfig(index, "stage", e.target.value)}
            className="text-sm mt-2"
          />
        );
      case "webhook":
        return (
          <Input
            placeholder="https://..."
            value={step.config.url || ""}
            onChange={(e) => updateStepConfig(index, "url", e.target.value)}
            className="text-sm mt-2"
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Trigger node */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 border border-primary/30">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium capitalize">
            {triggerType.replace(/_/g, " ")}
          </span>
          <Badge variant="outline" className="text-xs">Trigger</Badge>
        </div>
      </div>

      {/* Flow */}
      <div className="ml-5 border-l-2 border-dashed border-muted-foreground/30 pl-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {steps.map((step, i) => (
              <div key={i}>
                {/* Delay indicator */}
                {step.delay_minutes > 0 && (
                  <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Wait {step.delay_minutes >= 1440 ? `${Math.floor(step.delay_minutes / 1440)} day(s)` : step.delay_minutes >= 60 ? `${Math.floor(step.delay_minutes / 60)} hour(s)` : `${step.delay_minutes} min`}
                  </div>
                )}

                <Card className="relative">
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-md text-white ${STEP_TYPES[step.type]?.color || "bg-gray-400"}`}>
                        {STEP_TYPES[step.type]?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {STEP_TYPES[step.type]?.label || step.type}
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30">
                              <ArrowDown className="h-3 w-3 rotate-180" />
                            </button>
                            <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="text-muted-foreground disabled:opacity-30">
                              <ArrowDown className="h-3 w-3" />
                            </button>
                            <button onClick={() => removeStep(i)} className="text-destructive ml-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {renderStepConfig(step, i)}
                        <div className="mt-2 flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Wait</span>
                          <Input
                            type="number"
                            min={0}
                            value={step.delay_minutes}
                            onChange={(e) => updateStep(i, { delay_minutes: parseInt(e.target.value) || 0 })}
                            className="w-20 h-7 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">min before next step</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* Add step button */}
            {showAdd ? (
              <Card className="border-dashed">
                <CardContent className="py-3">
                  <div className="space-y-3">
                    <Label className="text-sm">Action Type</Label>
                    <Select value={newStepType} onValueChange={(v: string | null) => v && setNewStepType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STEP_TYPES).map(([key, val]) => (
                          <SelectItem key={key} value={key}>
                            {val.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{STEP_TYPES[newStepType]?.desc}</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addStep}>
                        <Plus className="mr-1 h-3 w-3" /> Add Step
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-full"
              >
                <Plus className="h-4 w-4" /> Add Step
              </button>
            )}
          </>
        )}
      </div>

      {/* Save */}
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save Workflow
        </Button>
        {saved && <span className="text-sm text-green-600">✅ Saved</span>}
        {steps.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {steps.length} step{steps.length !== 1 ? "s" : ""} in sequence
          </span>
        )}
      </div>
    </div>
  );
}
