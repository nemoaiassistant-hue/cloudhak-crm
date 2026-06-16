"use client";

import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical, Clock, User, Trash2, Loader2, Settings2 } from "lucide-react";
import { PermissionGate } from "@/components/rbac/permission-gate";

interface Stage {
  id: string;
  name: string;
  probability: number;
  color: string;
  sort_order: number;
}

interface Opportunity {
  id: string;
  title: string;
  value: number;
  currency: string;
  expected_close_date: string | null;
  stage_id: string;
  contact_id: string | null;
  contact_name?: string | null;
  assigned_to: string | null;
}

interface KanbanBoardProps {
  pipelineId: string;
  subaccountId: string;
}

export function KanbanBoard({ pipelineId, subaccountId }: KanbanBoardProps) {
  const supabase = createClient();
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);

  // Dialogs
  const [showAddStage, setShowAddStage] = useState(false);
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [showStageManage, setShowStageManage] = useState(false);
  const [oppStageId, setOppStageId] = useState<string | null>(null);

  // New stage form
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#94a3b8");
  const [stageProb, setStageProb] = useState("0");

  // New opportunity form
  const [oppTitle, setOppTitle] = useState("");
  const [oppValue, setOppValue] = useState("");
  const [oppContact, setOppContact] = useState("");
  const [oppCloseDate, setOppCloseDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: stageData }, { data: oppData }, { data: contactData }] = await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("id, name, probability, color, sort_order")
        .eq("pipeline_id", pipelineId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("opportunities")
        .select("id, title, value, currency, expected_close_date, stage_id, contact_id, assigned_to")
        .eq("pipeline_id", pipelineId),
      supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("subaccount_id", subaccountId)
        .order("first_name", { ascending: true }),
    ]);

    setStages((stageData || []) as Stage[]);

    const opps = (oppData || []) as Opportunity[];
    // Attach contact names
    const contactMap = new Map((contactData || []).map((c: { id: string; first_name: string; last_name: string }) => [
      c.id,
      `${c.first_name} ${c.last_name}`.trim(),
    ]));
    opps.forEach((o) => {
      o.contact_name = o.contact_id ? contactMap.get(o.contact_id) || null : null;
    });
    setOpportunities(opps);
    setContacts(
      (contactData || []).map((c: { id: string; first_name: string; last_name: string }) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
      }))
    );
    setLoading(false);
  }, [pipelineId, subaccountId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStageId = destination.droppableId;

    // Optimistic update
    setOpportunities((prev) =>
      prev.map((o) => (o.id === draggableId ? { ...o, stage_id: newStageId } : o))
    );

    await supabase
      .from("opportunities")
      .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
      .eq("id", draggableId);
  }

  async function createStage() {
    if (!stageName.trim()) return;
    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert({
        pipeline_id: pipelineId,
        name: stageName,
        probability: parseInt(stageProb) || 0,
        color: stageColor,
        sort_order: stages.length,
      })
      .select("id, name, probability, color, sort_order")
      .single();

    if (!error && data) {
      setStages((prev) => [...prev, data as Stage]);
      setShowAddStage(false);
      setStageName("");
      setStageColor("#94a3b8");
      setStageProb("0");
    }
  }

  async function deleteStage(id: string) {
    const oppsInStage = opportunities.filter((o) => o.stage_id === id);
    if (oppsInStage.length > 0) {
      if (!confirm(`This stage has ${oppsInStage.length} deals. Delete anyway? Deals will be lost.`)) return;
    }
    await supabase.from("pipeline_stages").delete().eq("id", id);
    setStages((prev) => prev.filter((s) => s.id !== id));
  }

  async function createOpportunity() {
    if (!oppTitle.trim() || !oppStageId) return;
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        subaccount_id: subaccountId,
        pipeline_id: pipelineId,
        stage_id: oppStageId,
        title: oppTitle,
        value: parseFloat(oppValue) || 0,
        currency: "GBP",
        contact_id: oppContact || null,
        expected_close_date: oppCloseDate || null,
        assigned_to: userData.user?.id,
      })
      .select("id, title, value, currency, expected_close_date, stage_id, contact_id, assigned_to")
      .single();

    if (!error && data) {
      const newOpp = data as Opportunity;
      newOpp.contact_name =
        oppContact ? contacts.find((c) => c.id === oppContact)?.name || null : null;
      setOpportunities((prev) => [...prev, newOpp]);
      setShowAddOpp(false);
      setOppTitle("");
      setOppValue("");
      setOppContact("");
      setOppCloseDate("");
      setOppStageId(null);
    }
    setCreating(false);
  }

  async function deleteOpportunity(id: string) {
    await supabase.from("opportunities").delete().eq("id", id);
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
  }

  function oppsByStage(stageId: string) {
    return opportunities.filter((o) => o.stage_id === stageId);
  }

  function stageValue(stageId: string) {
    return oppsByStage(stageId).reduce((sum, o) => sum + Number(o.value), 0);
  }

  const fmtGBP = (v: number) =>
    v.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  const totalValue = opportunities.reduce((sum, o) => sum + Number(o.value), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Board header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-sm">
            {opportunities.length} deals • {fmtGBP(totalValue)}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowStageManage(true)}>
            <Settings2 className="mr-1 h-4 w-4" /> Stages
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddStage(true)}>
            <Plus className="mr-1 h-4 w-4" /> Stage
          </Button>
          <PermissionGate subaccountId={subaccountId} require="pipelines.manage">
            <Button size="sm" onClick={() => { setOppStageId(stages[0]?.id || null); setShowAddOpp(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Deal
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 h-full min-w-max pb-4">
            {stages.map((stage) => {
              const stageOpps = oppsByStage(stage.id);
              return (
                <div key={stage.id} className="flex flex-col w-72 shrink-0">
                  {/* Stage header */}
                  <div className="mb-2 rounded-md bg-muted/50 p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-medium text-sm">{stage.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {stageOpps.length}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtGBP(stageValue(stage.id))}
                      </span>
                    </div>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto rounded-md p-1.5 space-y-2 min-h-[100px] transition-colors ${
                          snapshot.isDraggingOver ? "bg-muted/70" : ""
                        }`}
                      >
                        {stageOpps.map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`rounded-md border bg-card p-3 text-sm shadow-sm transition-shadow touch-none select-none ${
                                  snap.isDragging ? "shadow-lg opacity-90" : "hover:shadow-sm"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <p className="font-medium leading-tight">{opp.title}</p>
                                  <PermissionGate subaccountId={subaccountId} require="pipelines.manage">
                                    <button
                                      onClick={() => deleteOpportunity(opp.id)}
                                      className="ml-1 shrink-0 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </PermissionGate>
                                </div>
                                {opp.value > 0 && (
                                  <p className="mt-1 font-semibold text-green-600">
                                    {fmtGBP(Number(opp.value))}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                  {opp.contact_name && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {opp.contact_name}
                                    </span>
                                  )}
                                  {opp.expected_close_date && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(opp.expected_close_date).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {stageOpps.length === 0 && (
                          <button
                            onClick={() => { setOppStageId(stage.id); setShowAddOpp(true); }}
                            className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/50"
                          >
                            + Add deal
                          </button>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Add Stage Dialog */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label>Stage Name</Label>
              <Input
                placeholder="e.g. Negotiation"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createStage()}
              />
            </div>
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <Label>Win Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={stageProb}
                  onChange={(e) => setStageProb(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <input
                  type="color"
                  value={stageColor}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="h-9 w-14 rounded-md border border-input cursor-pointer"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStage(false)}>Cancel</Button>
            <Button onClick={createStage}>Add Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Management Dialog */}
      <Dialog open={showStageManage} onOpenChange={setShowStageManage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Stages</DialogTitle>
            <DialogDescription>Delete or review pipeline stages</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
            {stages.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant="outline" className="text-xs">{s.probability}%</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => deleteStage(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowStageManage(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Opportunity Dialog */}
      <Dialog open={showAddOpp} onOpenChange={setShowAddOpp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Deal</DialogTitle>
            <DialogDescription>Create a new opportunity in this pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Sleep apnea consultation"
                value={oppTitle}
                onChange={(e) => setOppTitle(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <Label>Value (£)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={oppValue}
                  onChange={(e) => setOppValue(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Expected Close</Label>
                <Input
                  type="date"
                  value={oppCloseDate}
                  onChange={(e) => setOppCloseDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={oppStageId || undefined}
                onValueChange={(v: string | null) => v && setOppStageId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact (optional)</Label>
              <Select value={oppContact || undefined} onValueChange={(v: string | null) => setOppContact(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOpp(false)}>Cancel</Button>
            <Button onClick={createOpportunity} disabled={creating || !oppTitle.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
