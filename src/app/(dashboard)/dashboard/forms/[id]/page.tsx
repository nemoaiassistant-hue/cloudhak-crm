import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FormBuilder } from "@/components/forms/form-builder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ExternalLink, Inbox } from "lucide-react";

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, fields, is_active, embed_key, subaccount_id")
    .eq("id", id)
    .single();

  if (!form) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Form not found.</p>
        <Link href="/dashboard/forms">
          <Button variant="link">← Back to forms</Button>
        </Link>
      </div>
    );
  }

  // Get submission count
  const { count: submissionCount } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/dashboard/forms" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Forms
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Form Builder</h1>
            {form.is_active ? (
              <Badge className="bg-green-500">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
            <Link href={`/dashboard/forms/${id}/submissions`}>
              <Button variant="outline" size="sm">
                <Inbox className="mr-1 h-4 w-4" />
                Submissions ({submissionCount || 0})
              </Button>
            </Link>
          </div>
          <a href={`/forms/${form.embed_key}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1 h-4 w-4" /> View Live
            </Button>
          </a>
        </div>
      </div>

      <FormBuilder
        formId={form.id}
        initialName={form.name}
        initialFields={form.fields as { type: string; label: string; key: string; required: boolean; placeholder?: string; options?: string[] }[]}
      />
    </div>
  );
}
