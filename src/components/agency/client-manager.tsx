"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2, Plus, Settings, Users, Trash2, ExternalLink, Loader2,
} from "lucide-react";
import Link from "next/link";

interface SubAccount {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
  created_at: string;
  teamCount: number;
  contactCount: number;
}

export function ClientManager({ orgId, currentUserId }: { orgId: string; currentUserId: string }) {
  const supabase = createClient();
  const [clients, setClients] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<SubAccount | null>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchClients = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const { data: subAccounts } = await supabase
      .from("sub_accounts")
      .select("id, name, slug, branding, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (!subAccounts) {
      setClients([]);
      setLoading(false);
      return;
    }

    // Fetch team counts and contact counts for each
    const enriched = await Promise.all(
      subAccounts.map(async (sa) => {
        const [teamRes, contactsRes] = await Promise.all([
          supabase.from("user_subaccount_roles").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id),
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("subaccount_id", sa.id),
        ]);

        return {
          ...sa,
          branding: sa.branding as Record<string, unknown>,
          teamCount: teamRes.count || 0,
          contactCount: contactsRes.count || 0,
        } as SubAccount;
      })
    );

    setClients(enriched);
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);

    const slug = newSlug.trim() || newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const { data: newSA, error } = await supabase
      .from("sub_accounts")
      .insert({
        org_id: orgId,
        name: newName.trim(),
        slug,
        branding: {},
      })
      .select("id")
      .single();

    if (!error && newSA) {
      // Assign current user as admin of the new sub-account
      await supabase.from("user_subaccount_roles").insert({
        user_id: currentUserId,
        subaccount_id: newSA.id,
        role: "admin",
      });
    }

    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    setNewSlug("");
    fetchClients();
  }

  async function handleUpdateClient(client: SubAccount, name: string) {
    await supabase
      .from("sub_accounts")
      .update({ name })
      .eq("id", client.id);

    setEditClient(null);
    fetchClients();
  }

  async function handleDeleteClient(client: SubAccount) {
    if (!confirm(`Delete "${client.name}"? This permanently removes ALL contacts, deals, forms, automations, and data for this workspace. This cannot be undone.`)) return;

    await supabase.from("sub_accounts").delete().eq("id", client.id);
    fetchClients();
  }

  function slugify(name: string) {
    setNewName(name);
    setNewSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading clients...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Workspaces</h2>
          <p className="text-sm text-muted-foreground">{clients.length} workspace{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button variant="default"><Plus className="mr-2 h-4 w-4" /> New Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Client Workspace</DialogTitle>
              <DialogDescription>
                Each client gets their own isolated workspace with separate contacts, pipelines, and team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  placeholder="e.g. Airway Clinic"
                  value={newName}
                  onChange={(e) => slugify(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL identifier)</Label>
                <Input
                  placeholder="airway-clinic"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Used in URLs and API references</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: (client.branding?.primaryColor as string) || "#6366f1" }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{client.name}</p>
                    <p className="text-xs text-muted-foreground">/{client.slug}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  Active
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Contacts</p>
                  <p className="text-lg font-bold">{client.contactCount.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Team</p>
                  <p className="text-lg font-bold">{client.teamCount}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/contacts?sa=${client.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open
                  </Button>
                </Link>
                <Dialog open={editClient?.id === client.id} onOpenChange={(open) => !open && setEditClient(null)}>
                  <DialogTrigger>
                    <Button variant="ghost" size="sm" onClick={() => setEditClient(client)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit {client.name}</DialogTitle>
                    </DialogHeader>
                    <EditClientForm client={client} onSave={handleUpdateClient} onCancel={() => setEditClient(null)} />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClient(client)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Create card */}
        <Card
          className="border-dashed border-2 hover:border-primary hover:bg-muted/30 transition-colors cursor-pointer min-h-[200px]"
          onClick={() => setCreateOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center h-full pt-6">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">New Client Workspace</p>
            <p className="text-xs text-muted-foreground mt-1">Add a new client</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EditClientForm({ client, onSave, onCancel }: {
  client: SubAccount;
  onSave: (client: SubAccount, name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(client.name);

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Client Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Slug</Label>
        <Input value={client.slug} disabled className="bg-muted" />
        <p className="text-xs text-muted-foreground">Slug cannot be changed after creation</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(client, name)}>Save Changes</Button>
      </DialogFooter>
    </div>
  );
}
