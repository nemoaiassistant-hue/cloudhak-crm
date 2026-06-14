"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";
import {
  ContactForm,
  type ContactFormInitialData,
} from "@/components/contacts/contact-form";
import { ArrowLeft } from "lucide-react";

export default function EditContactPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const contactId = params.id;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<ContactFormInitialData | null>(
    null
  );
  const [subaccountId, setSubaccountId] = useState<string>("");

  useEffect(() => {
    async function loadContact() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (!error && data) {
        setInitialData({
          id: data.id,
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          status: data.status || "lead",
          source: data.source || "",
          tags: data.tags || [],
          consent_sms: data.consent_sms || false,
          consent_email: data.consent_email || false,
        });
        setSubaccountId(data.subaccount_id || "");
      }
      setLoading(false);
    }
    loadContact();
  }, [contactId]);

  if (loading) {
    return <div className="p-6">Loading contact...</div>;
  }

  if (!initialData || !subaccountId) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Edit Contact</h1>
        <p className="text-muted-foreground">
          Contact not found or you don&apos;t have access.
        </p>
        <Link
          href="/dashboard/contacts"
          className={`${buttonVariants({ variant: "outline" })} mt-4 gap-1.5`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/dashboard/contacts/${contactId}`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Edit Contact</h1>
      </div>
      <ContactForm
        initialData={initialData}
        subaccountId={subaccountId}
        onSuccess={() => router.push(`/dashboard/contacts/${contactId}`)}
      />
    </div>
  );
}
