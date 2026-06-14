"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export interface ContactFormInitialData {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  tags?: string[];
  consent_sms?: boolean;
  consent_email?: boolean;
}

interface ContactFormProps {
  initialData?: ContactFormInitialData;
  subaccountId: string;
  onSuccess?: (contactId: string) => void;
}

export function ContactForm({
  initialData,
  subaccountId,
  onSuccess,
}: ContactFormProps) {
  const isEditing = !!initialData?.id;

  const [firstName, setFirstName] = useState(initialData?.first_name || "");
  const [lastName, setLastName] = useState(initialData?.last_name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [status, setStatus] = useState(initialData?.status || "lead");
  const [source, setSource] = useState(initialData?.source || "");
  const [tagsInput, setTagsInput] = useState(
    (initialData?.tags || []).join(", ")
  );
  const [consentSms, setConsentSms] = useState(initialData?.consent_sms || false);
  const [consentEmail, setConsentEmail] = useState(
    initialData?.consent_email || false
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() && !lastName.trim()) {
      setError("At least a first name or last name is required.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const hasConsent = consentSms || consentEmail;

    const payload: Record<string, unknown> = {
      subaccount_id: subaccountId,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      status,
      source: source.trim() || null,
      tags,
      consent_sms: consentSms,
      consent_email: consentEmail,
    };

    if (hasConsent) {
      payload.consent_date = new Date().toISOString();
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (isEditing && initialData?.id) {
        const { data, error: updateError } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", initialData.id)
          .select("id")
          .single();

        if (updateError) throw updateError;

        await supabase.from("contact_activity").insert({
          contact_id: initialData.id,
          type: "updated",
          summary: "Contact details updated",
          created_by: (await supabase.auth.getUser()).data.user?.id || null,
        });

        onSuccess?.(data.id);
      } else {
        const { data, error: insertError } = await supabase
          .from("contacts")
          .insert(payload)
          .select("id")
          .single();

        if (insertError) throw insertError;

        await supabase.from("contact_activity").insert({
          contact_id: data.id,
          type: "created",
          summary: "Contact created",
          created_by: (await supabase.auth.getUser()).data.user?.id || null,
        });

        onSuccess?.(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                type="text"
                placeholder="Website, Referral, etc."
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val || "lead")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              type="text"
              placeholder="VIP, Newsletter, etc. (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple tags with commas.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Consent</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="consent_sms"
                  checked={consentSms}
                  onCheckedChange={(checked) => setConsentSms(checked)}
                />
                <Label htmlFor="consent_sms" className="cursor-pointer">
                  SMS consent
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="consent_email"
                  checked={consentEmail}
                  onCheckedChange={(checked) => setConsentEmail(checked)}
                />
                <Label htmlFor="consent_email" className="cursor-pointer">
                  Email consent
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Contact"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
