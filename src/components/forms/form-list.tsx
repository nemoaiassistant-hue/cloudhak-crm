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
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Inbox,
} from "lucide-react";
import { PermissionGate } from "@/components/rbac/permission-gate";

interface FormItem {
  id: string;
  name: string;
  fields: unknown[];
  is_active: boolean;
  embed_key: string;
  created_at: string;
  submission_count?: number;
}

export function FormList({ subaccountId }: { subaccountId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadForms = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forms")
      .select("id, name, fields, is_active, embed_key, created_at")
      .eq("subaccount_id", subaccountId)
      .order("created_at", { ascending: false });

    const formList = (data || []) as FormItem[];

    // Get submission counts
    for (const f of formList) {
      const { count } = await supabase
        .from("form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("form_id", f.id);
      f.submission_count = count || 0;
    }

    setForms(formList);
    setLoading(false);
  }, [subaccountId, supabase]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  async function createForm() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("forms")
      .insert({
        subaccount_id: subaccountId,
        name: newName,
        fields: [
          { type: "text", label: "First Name", key: "first_name", required: true },
          { type: "text", label: "Last Name", key: "last_name", required: true },
          { type: "email", label: "Email", key: "email", required: true },
          { type: "tel", label: "Phone", key: "phone", required: false },
        ],
        is_active: true,
      })
      .select("id")
      .single();

    if (!error && data) {
      setShowCreate(false);
      setNewName("");
      router.push(`/dashboard/forms/${data.id}`);
    }
    setCreating(false);
  }

  async function toggleActive(form: FormItem) {
    const newVal = !form.is_active;
    await supabase.from("forms").update({ is_active: newVal }).eq("id", form.id);
    setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, is_active: newVal } : f)));
  }

  async function deleteForm(id: string) {
    if (!confirm("Delete this form and all submissions?")) return;
    await supabase.from("forms").delete().eq("id", id);
    setForms((prev) => prev.filter((f) => f.id !== id));
  }

  function copyEmbed(key: string) {
    const url = `${window.location.origin}/forms/${key}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{forms.length} form{forms.length !== 1 ? "s" : ""}</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <PermissionGate subaccountId={subaccountId} require="forms.manage">
            <DialogTrigger>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> New Form
              </Button>
            </DialogTrigger>
          </PermissionGate>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Form</DialogTitle>
              <DialogDescription>Starts with name, email, and phone fields</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="formName">Form Name</Label>
                <Input
                  id="formName"
                  placeholder="e.g. Contact Us, Patient Intake"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createForm()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createForm} disabled={creating}>
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
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">No forms yet. Create one to start collecting leads.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex flex-1 items-center gap-3 cursor-pointer"
                    onClick={() => router.push(`/dashboard/forms/${form.id}`)}
                  >
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{form.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {Array.isArray(form.fields) ? form.fields.length : 0} fields
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Inbox className="mr-0.5 h-3 w-3" />
                          {form.submission_count} submissions
                        </Badge>
                        {form.is_active ? (
                          <Badge className="bg-green-500 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-2">
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={() => toggleActive(form)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyEmbed(form.embed_key)}
                    >
                      {copiedKey === form.embed_key ? (
                        <><Check className="mr-1 h-3 w-3" /> Copied</>
                      ) : (
                        <><Copy className="mr-1 h-3 w-3" /> Link</>
                      )}
                    </Button>
                    <a href={`/forms/${form.embed_key}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    <PermissionGate subaccountId={subaccountId} require="forms.manage">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteForm(form.id)}
                      >
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
