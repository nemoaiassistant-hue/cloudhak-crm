"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface AddNoteFormProps {
  contactId: string;
}

export function AddNoteForm({ contactId }: AddNoteFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: noteError } = await supabase.from("contact_notes").insert({
        contact_id: contactId,
        author_id: user?.id || null,
        body: body.trim(),
        is_internal: isInternal,
      });

      if (noteError) throw noteError;

      await supabase.from("contact_activity").insert({
        contact_id: contactId,
        type: "note",
        summary: isInternal
          ? `Internal note added: ${body.trim().slice(0, 80)}${body.trim().length > 80 ? "..." : ""}`
          : `Note added: ${body.trim().slice(0, 80)}${body.trim().length > 80 ? "..." : ""}`,
        metadata: { is_internal: isInternal },
        created_by: user?.id || null,
      });

      setBody("");
      setIsInternal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="note-body">Add a note</Label>
        <Textarea
          id="note-body"
          placeholder="Write a note about this contact..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="internal-note"
            checked={isInternal}
            onCheckedChange={(checked) => setIsInternal(checked)}
          />
          <Label htmlFor="internal-note" className="cursor-pointer text-sm">
            Internal only
          </Label>
        </div>
        <Button type="submit" disabled={loading || !body.trim()}>
          {loading ? "Adding..." : "Add Note"}
        </Button>
      </div>
    </form>
  );
}
