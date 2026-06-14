"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Upload, CheckCircle2, AlertCircle, ArrowRight, FileSpreadsheet,
} from "lucide-react";

interface ImportResult {
  total: number;
  processed: number;
  failed: number;
  errors: string[];
}

export function GHLMigration({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [apiKey, setApiKey] = useState("");
  const [locationId, setLocationId] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function previewContacts() {
    setError(null);
    if (!apiKey || !locationId) {
      setError("API key and Location ID are required");
      return;
    }

    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/contacts?locationId=${locationId}&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Version: "2021-07-28",
          },
        }
      );

      if (!res.ok) {
        setError(`GHL API error: ${res.status} — check your API key and location ID`);
        return;
      }

      const data = await res.json();
      setPreview(data.contacts?.length || 0);
    } catch {
      setError("Failed to connect to GoHighLevel. Check your credentials.");
    }
  }

  async function startImport() {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // Create import job
      const { data: job } = await supabase
        .from("import_jobs")
        .insert({
          subaccount_id: subaccountId,
          source: "ghl",
          status: "processing",
          config: { apiKey, locationId },
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      // Fetch all contacts from GHL (paginated)
      let allContacts: Array<Record<string, unknown>> = [];
      let cursor = "";
      const maxPages = 20;

      for (let page = 0; page < maxPages; page++) {
        const url = `https://services.leadconnectorhq.com/contacts?locationId=${locationId}&limit=100${cursor ? `&cursor=${cursor}` : ""}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Version: "2021-07-28",
          },
        });

        if (!res.ok) break;
        const data = await res.json();
        allContacts = [...allContacts, ...(data.contacts || [])];
        cursor = data.nextCursor || "";
        if (!cursor) break;
      }

      const errors: string[] = [];
      let processed = 0;
      let failed = 0;

      // Transform and insert
      const transformed = allContacts.map((c: Record<string, unknown>) => {
        const name = (c.contactName as string || "").split(" ");
        return {
          subaccount_id: subaccountId,
          first_name: name[0] || "",
          last_name: name.slice(1).join(" ") || "",
          email: (c.email as string) || null,
          phone: (c.phone as string) || null,
          tags: Array.isArray(c.tags) ? c.tags : [],
          source: "import" as const,
          status: "lead" as const,
          custom_fields: {
            ghl_id: c.id,
            ...(c.customField || {}),
          },
        };
      });

      // Insert in batches of 100
      for (let i = 0; i < transformed.length; i += 100) {
        const batch = transformed.slice(i, i + 100);
        const { error: insertError } = await supabase.from("contacts").insert(batch);

        if (insertError) {
          failed += batch.length;
          errors.push(`Batch ${Math.floor(i / 100) + 1}: ${insertError.message}`);
        } else {
          processed += batch.length;
        }
      }

      // Update job
      if (job) {
        await supabase.from("import_jobs").update({
          status: "completed",
          total_records: allContacts.length,
          processed_records: processed,
          failed_records: failed,
          error_log: errors,
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
      }

      setResult({
        total: allContacts.length,
        processed,
        failed,
        errors,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Import contacts from your GoHighLevel account. You'll need a <strong>Private Integration API Key</strong> with contacts access and your <strong>Location ID</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GHL Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Private Integration API Key</Label>
            <Input
              type="password"
              placeholder="pit-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Location ID</Label>
            <Input
              placeholder="e.g. abc123..."
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={previewContacts} disabled={!apiKey || !locationId}>
            Test Connection & Preview
          </Button>

          {preview !== null && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Connected! Found at least <strong>{preview}</strong> contacts in first 10.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <input type="checkbox" defaultChecked id="import-tags" className="rounded" />
            <label htmlFor="import-tags" className="text-sm">Import tags</label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <input type="checkbox" defaultChecked id="import-custom" className="rounded" />
            <label htmlFor="import-custom" className="text-sm">Import custom fields</label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <input type="checkbox" id="import-pipelines" className="rounded" />
            <label htmlFor="import-pipelines" className="text-sm">Import opportunities (coming soon)</label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span className="text-lg font-semibold">Import Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total Found</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{result.processed}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">View errors ({result.errors.length})</summary>
                <div className="mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        size="lg"
        onClick={startImport}
        disabled={importing || !apiKey || !locationId}
        className="w-full"
      >
        {importing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
        ) : (
          <><Upload className="mr-2 h-4 w-4" /> Start Import</>
        )}
      </Button>
    </div>
  );
}
