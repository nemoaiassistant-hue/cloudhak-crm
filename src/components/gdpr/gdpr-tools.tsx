"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Download, Trash2, Loader2, ShieldCheck, AlertTriangle, FileJson, CheckCircle2,
} from "lucide-react";

export function GDPRTools({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [exportEmail, setExportEmail] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportResult, setExportResult] = useState<{ count: number; url: string } | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ deleted: boolean; records: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    setError(null);
    setExportResult(null);

    try {
      // Fetch all data for contacts matching the email
      const { data: contacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("subaccount_id", subaccountId)
        .ilike("email", exportEmail);

      if (!contacts || contacts.length === 0) {
        setError("No contacts found with that email address.");
        setExporting(false);
        return;
      }

      const contactIds = contacts.map((c) => c.id);

      // Fetch all related data
      const [activity, notes, conversations, appointments, tasks, consent, submissions] = await Promise.all([
        supabase.from("contact_activity").select("*").in("contact_id", contactIds),
        supabase.from("contact_notes").select("*").in("contact_id", contactIds),
        supabase.from("conversations").select("*").in("contact_id", contactIds),
        supabase.from("calendar_events").select("*").in("contact_id", contactIds),
        supabase.from("tasks").select("*").in("contact_id", contactIds),
        supabase.from("consent_records").select("*").in("contact_id", contactIds),
        supabase.from("form_submissions").select("*").in("contact_id", contactIds),
      ] as const);

      // Get messages for conversations
      let messageData: unknown[] = [];
      if (conversations.data && conversations.data.length > 0) {
        const convIds = conversations.data.map((c: { id: string }) => c.id);
        const { data: msgs } = await supabase.from("messages").select("*").in("conversation_id", convIds);
        messageData = msgs || [];
      }

      const exportPayload = {
        exported_at: new Date().toISOString(),
        subaccount_id: subaccountId,
        contacts: contacts,
        activity: activity.data || [],
        notes: notes.data || [],
        conversations: conversations.data || [],
        messages: messageData,
        appointments: appointments.data || [],
        tasks: tasks.data || [],
        consent_records: consent.data || [],
        form_submissions: submissions.data || [],
      };

      // Create downloadable JSON
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      setExportResult({ count: contacts.length, url });

      // Auto-download
      const a = document.createElement("a");
      a.href = url;
      a.download = `gdpr-export-${exportEmail}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
    } catch {
      setError("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteData() {
    setDeleting(true);
    setError(null);

    try {
      // Find contact
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("subaccount_id", subaccountId)
        .ilike("email", deleteEmail);

      if (!contacts || contacts.length === 0) {
        setError("No contacts found with that email.");
        setDeleting(false);
        return;
      }

      const contactIds = contacts.map((c) => c.id);
      let totalRecords = 0;

      // Delete in dependency order (cascading handles most, but be explicit)
      // Consent records
      const { count: consentCount } = await supabase.from("consent_records").delete().in("contact_id", contactIds);
      totalRecords += consentCount || 0;

      // Notes
      const { count: notesCount } = await supabase.from("contact_notes").delete().in("contact_id", contactIds);
      totalRecords += notesCount || 0;

      // Activity
      const { count: activityCount } = await supabase.from("contact_activity").delete().in("contact_id", contactIds);
      totalRecords += activityCount || 0;

      // Tasks
      await supabase.from("tasks").update({ contact_id: null }).in("contact_id", contactIds);

      // Appointments
      await supabase.from("calendar_events").update({ contact_id: null }).in("contact_id", contactIds);

      // Form submissions
      await supabase.from("form_submissions").update({ contact_id: null }).in("contact_id", contactIds);

      // Opportunities
      await supabase.from("opportunities").update({ contact_id: null }).in("contact_id", contactIds);

      // Conversations + messages
      const { data: convs } = await supabase.from("conversations").select("id").in("contact_id", contactIds);
      if (convs && convs.length > 0) {
        const convIds = convs.map((c: { id: string }) => c.id);
        await supabase.from("messages").delete().in("conversation_id", convIds);
        await supabase.from("conversations").delete().in("id", convIds);
      }

      // Finally, delete the contact(s) — cascade handles the rest
      const { count: contactCount } = await supabase.from("contacts").delete().in("id", contactIds);
      totalRecords += (contactCount || 0) + notesCount! + activityCount!;

      setDeleteResult({ deleted: true, records: totalRecords });
      setConfirmDelete(false);
    } catch {
      setError("Failed to delete data. Check permissions and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          GDPR compliance tools for UK data protection. Export all personal data for a contact (Article 15 — Right of Access) or permanently delete it (Article 17 — Right to Erasure).
        </AlertDescription>
      </Alert>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-4 w-4" /> Data Export (Article 15)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contact Email Address</Label>
            <Input
              type="email"
              placeholder="patient@example.com"
              value={exportEmail}
              onChange={(e) => setExportEmail(e.target.value)}
            />
          </div>
          <Button onClick={exportData} disabled={!exportEmail || exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export All Data
          </Button>
          {exportResult && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Exported <strong>{exportResult.count}</strong> contact(s) with all related records. Download started automatically.
              <a href={exportResult.url} download={`gdpr-export.json`} className="text-blue-500 underline ml-2">
                Re-download
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right to Erasure */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <AlertTriangle className="h-4 w-4" /> Right to Erasure (Article 17)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Permanent deletion.</strong> This removes the contact and ALL associated data: activity, notes, messages, appointments, tasks, consent records. Cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Contact Email to Delete</Label>
            <Input
              type="email"
              placeholder="patient@example.com"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
            />
          </div>

          {!confirmDelete ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={!deleteEmail}>
              <Trash2 className="mr-2 h-4 w-4" /> Request Deletion
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Are you absolutely sure? Type the email to confirm:
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={deleteData} disabled={deleting || !deleteEmail}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Yes, Permanently Delete
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {deleteResult && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Permanently deleted contact data. <strong>{deleteResult.records}</strong> records removed across all tables.
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
