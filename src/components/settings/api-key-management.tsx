"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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
import { KeyRound, Plus, Trash2, Copy, Check, Loader2 } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function ApiKeyManagement({
  keys,
  subaccountId,
}: {
  keys: ApiKey[];
  subaccountId: string;
}) {
  const supabase = createClient();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [localKeys, setLocalKeys] = useState(keys);

  async function createKey() {
    if (!keyName.trim()) return;
    setCreating(true);

    // Generate a random key
    const rawKey = "chk_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const keyPrefix = rawKey.slice(0, 12);

    // Hash the key using Subabase RPC (or client-side SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("api_keys").insert({
      subaccount_id: subaccountId,
      name: keyName,
      key_hash: hashHex,
      key_prefix: keyPrefix,
      scopes: ["contacts", "tasks", "notes"],
      created_by: userData.user?.id,
    });

    setCreating(false);

    if (error) {
      alert("Error creating key: " + error.message);
      return;
    }

    // Show the key once
    setNewKey(rawKey);
    setKeyName("");
    setLocalKeys((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: keyName,
        key_prefix: keyPrefix,
        scopes: ["contacts", "tasks", "notes"],
        last_used_at: null,
        expires_at: null,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await supabase.from("api_keys").delete().eq("id", id);
    setLocalKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Generate keys to access the CRM API programmatically
          </CardDescription>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setNewKey(null); }}>
          <DialogTrigger>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Generate Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Copy your key now — you won&apos;t be able to see it again.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-muted p-3 text-xs break-all">
                      {newKey}
                    </code>
                    <Button size="icon" variant="outline" onClick={copyKey}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => { setShowCreate(false); setNewKey(null); }}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Generate New API Key</DialogTitle>
                  <DialogDescription>
                    Name your key to identify where it&apos;s used
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g. Website Forms, Zapier Integration"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button onClick={createKey} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {localKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No API keys yet. Generate one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {localKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{key.name}</p>
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <code>{key.key_prefix}...</code>
                    <span className="mx-2">•</span>
                    Created: {formatDate(key.created_at)}
                    <span className="mx-2">•</span>
                    Last used: {formatDate(key.last_used_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeKey(key.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
