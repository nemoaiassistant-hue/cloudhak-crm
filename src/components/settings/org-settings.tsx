"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Plus, Trash2, Loader2 } from "lucide-react";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
}

interface SubAccount {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
}

export function OrgSettings({ org, subAccounts }: { org: OrgData; subAccounts: SubAccount[] }) {
  const supabase = createClient();
  const [orgName, setOrgName] = useState(org.name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreateSub, setShowCreateSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [creating, setCreating] = useState(false);

  async function saveOrg() {
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName })
      .eq("id", org.id);
    setSaving(false);
    setMessage(error ? `Error: ${error.message}` : "✅ Saved");
    setTimeout(() => setMessage(null), 3000);
  }

  async function createSubAccount() {
    if (!newSubName.trim()) return;
    setCreating(true);
    const slug = newSubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data, error } = await supabase
      .from("sub_accounts")
      .insert({ org_id: org.id, name: newSubName, slug })
      .select()
      .single();

    if (!error && data) {
      // Assign current user as admin of new sub-account
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("user_subaccount_roles").insert({
          user_id: userData.user.id,
          subaccount_id: data.id,
          role: "admin",
        });
      }
    }

    setCreating(false);
    setShowCreateSub(false);
    setNewSubName("");
    if (!error) window.location.reload();
  }

  async function deleteSubAccount(id: string) {
    if (!confirm("Delete this sub-account? All contacts and data will be lost.")) return;
    await supabase.from("sub_accounts").delete().eq("id", id);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </CardTitle>
          <CardDescription>Manage your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Plan:</span>
            <Badge variant="secondary" className="capitalize">{org.plan_tier}</Badge>
            <span className="text-muted-foreground">Slug:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{org.slug}</code>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveOrg} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
          {message && <span className="ml-3 text-sm">{message}</span>}
        </CardFooter>
      </Card>

      {/* Sub-Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sub-Accounts / Workspaces</CardTitle>
            <CardDescription>Each workspace has its own contacts, pipelines, and team</CardDescription>
          </div>
          <Dialog open={showCreateSub} onOpenChange={setShowCreateSub}>
            <DialogTrigger>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sub-Account</DialogTitle>
                <DialogDescription>Add a new workspace for a business or department</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subName">Name</Label>
                  <Input
                    id="subName"
                    placeholder="e.g. Airway Clinic"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateSub(false)}>Cancel</Button>
                <Button onClick={createSubAccount} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {subAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No sub-accounts yet. Create your first workspace above.
            </p>
          ) : (
            <div className="space-y-2">
              {subAccounts.map((sa) => (
                <div
                  key={sa.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{sa.name}</p>
                    <p className="text-xs text-muted-foreground">{sa.slug}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSubAccount(sa.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
