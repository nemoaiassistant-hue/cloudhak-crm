"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface FormField {
  type: string;
  label: string;
  key: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export function PublicForm({
  formId,
  formName,
  fields,
  subaccountId,
}: {
  formId: string;
  formName: string;
  fields: FormField[];
  subaccountId: string;
}) {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validate required fields
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        setError(`Please fill in: ${field.label}`);
        setSubmitting(false);
        return;
      }
    }

    // 1. Create contact from form data
    const firstName = values.first_name || "";
    const lastName = values.last_name || "";
    const email = values.email || "";
    const phone = values.phone || "";

    const { data: contact } = await supabase
      .from("contacts")
      .insert({
        subaccount_id: subaccountId,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        source: "form",
        status: "lead",
        consent_email: !!email,
        consent_sms: !!phone,
        consent_date: new Date().toISOString(),
        custom_fields: fields
          .filter((f) => !["first_name", "last_name", "email", "phone"].includes(f.key))
          .reduce((acc, f) => {
            if (values[f.key]) acc[f.key] = values[f.key];
            return acc;
          }, {} as Record<string, string>),
      })
      .select("id")
      .single();

    // 2. Record form submission
    await supabase.from("form_submissions").insert({
      form_id: formId,
      contact_id: contact?.id || null,
      data: values,
      ip_address: null,
      user_agent: navigator.userAgent,
    });

    // 3. Log activity
    if (contact) {
      await supabase.from("contact_activity").insert({
        contact_id: contact.id,
        type: "form_submit",
        summary: `Submitted form: ${formName}`,
        metadata: { form_id: formId, form_name: formName },
      });

      // Record consent
      if (email) {
        await supabase.from("consent_records").insert({
          contact_id: contact.id,
          type: "email",
          granted: true,
          method: "form",
        });
      }
      if (phone) {
        await supabase.from("consent_records").insert({
          contact_id: contact.id,
          type: "sms",
          granted: true,
          method: "form",
        });
      }
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Thank you!</h2>
            <p className="text-muted-foreground">Your submission has been received. We&apos;ll be in touch shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">{formName}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm">
                  {field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {field.type === "textarea" ? (
                  <textarea
                    id={field.key}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder={field.placeholder}
                    rows={3}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.key}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={values[field.key] || ""}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={field.key}
                      className="rounded"
                      checked={values[field.key] === "true"}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.checked ? "true" : "" })}
                    />
                    <span className="text-sm text-muted-foreground">{field.placeholder || "I agree"}</span>
                  </div>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    placeholder={field.placeholder}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
