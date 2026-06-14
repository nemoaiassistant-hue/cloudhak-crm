"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ContactForm } from "@/components/contacts/contact-form";
import { ArrowLeft } from "lucide-react";

export default function NewContactPage() {
  const router = useRouter();
  const [subaccountId, setSubaccountId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("active-subaccount");
    setSubaccountId(id);
    setChecked(true);
  }, []);

  if (!checked) {
    return <div className="p-6">Loading...</div>;
  }

  if (!subaccountId) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Add Contact</h1>
        <p className="text-muted-foreground">
          Please select a workspace from the sidebar first.
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
          href="/dashboard/contacts"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Add Contact</h1>
      </div>
      <ContactForm
        subaccountId={subaccountId}
        onSuccess={(id) => router.push(`/dashboard/contacts/${id}`)}
      />
    </div>
  );
}
