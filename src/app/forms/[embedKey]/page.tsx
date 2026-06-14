import { createClient } from "@/lib/supabase/server";
import { PublicForm } from "@/components/forms/public-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ embedKey: string }>;
}) {
  const { embedKey } = await params;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, fields, is_active, subaccount_id")
    .eq("embed_key", embedKey)
    .single();

  if (!form || !form.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <h2 className="text-xl font-bold mb-2">Form Unavailable</h2>
            <p className="text-muted-foreground">
              This form is no longer accepting submissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PublicForm
      formId={form.id}
      formName={form.name}
      fields={form.fields as { type: string; label: string; key: string; required: boolean; placeholder?: string; options?: string[] }[]}
      subaccountId={form.subaccount_id}
    />
  );
}
