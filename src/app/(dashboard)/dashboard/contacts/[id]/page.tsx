import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/contacts/status-badge";
import { AddNoteForm } from "@/components/contacts/add-note-form";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  Tag,
  UserCircle,
  Clock,
  FileText,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ContactDetail {
  id: string;
  subaccount_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  tags: string[] | null;
  assigned_to: string | null;
  consent_sms: boolean;
  consent_email: boolean;
  consent_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

interface NoteEntry {
  id: string;
  contact_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

const ACTIVITY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  call: Phone,
  email: Mail,
  sms: Mail,
  note: FileText,
  appointment: Clock,
  status_change: UserCircle,
  form_submit: FileText,
  created: UserCircle,
  updated: UserCircle,
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (!contact) {
    notFound();
  }

  const c = contact as unknown as ContactDetail;

  const fullName =
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed Contact";

  // Fetch activity timeline
  const { data: activity } = await supabase
    .from("contact_activity")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch notes
  const { data: notes } = await supabase
    .from("contact_notes")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false });

  // Fetch assignee name
  let assigneeName: string | null = null;
  if (c.assigned_to) {
    const { data: assignee } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", c.assigned_to)
      .single();
    assigneeName = assignee?.full_name || null;
  }

  const activityList = (activity || []) as unknown as ActivityEntry[];
  const noteList = (notes || []) as unknown as NoteEntry[];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/contacts"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{fullName}</h1>
              <StatusBadge status={c.status} />
            </div>
            {c.source && (
              <p className="mt-1 text-sm text-muted-foreground">
                Source: {c.source}
              </p>
            )}
          </div>
        </div>
        <Link
          href={`/dashboard/contacts/${id}/edit`}
          className={buttonVariants({ className: "gap-1.5" })}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Contact info + Notes */}
        <div className="space-y-6 lg:col-span-1">
          {/* Contact info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={c.email}
                  href={c.email ? `mailto:${c.email}` : undefined}
                />
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={c.phone}
                  href={c.phone ? `tel:${c.phone}` : undefined}
                />
                <InfoRow
                  icon={UserCircle}
                  label="Assigned To"
                  value={assigneeName || undefined}
                />
              </div>

              {(c.tags || []).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Tag className="h-4 w-4" />
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(c.tags || []).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(c.consent_sms || c.consent_email) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Consent</div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {c.consent_sms && (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          SMS consent granted
                        </span>
                      )}
                      {c.consent_email && (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Email consent granted
                        </span>
                      )}
                      {c.consent_date && (
                        <span className="text-xs">
                          {format(new Date(c.consent_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="text-xs text-muted-foreground">
                Created{" "}
                {formatDistanceToNow(new Date(c.created_at), {
                  addSuffix: true,
                })}
                {c.updated_at !== c.created_at && (
                  <>
                    {" · "}Updated{" "}
                    {formatDistanceToNow(new Date(c.updated_at), {
                      addSuffix: true,
                    })}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddNoteForm contactId={id} />

              {noteList.length > 0 ? (
                <div className="space-y-3">
                  <Separator />
                  {noteList.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        {note.is_internal && (
                          <Badge variant="outline" className="text-xs">
                            Internal
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{note.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Activity timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activityList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-0">
                  {activityList.map((entry, idx) => {
                    const Icon = ACTIVITY_ICONS[entry.type] || Clock;
                    const isLast = idx === activityList.length - 1;
                    return (
                      <div key={entry.id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {!isLast && (
                            <div className="w-px flex-1 bg-border" />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 ${isLast ? "" : "pb-6"}`}>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="ghost"
                              className="capitalize text-xs"
                            >
                              {entry.type.replace("_", " ")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          {entry.summary && (
                            <p className="mt-1 text-sm">{entry.summary}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  href?: string;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}:</span>
        <span className="text-sm">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      {href ? (
        <a
          href={href}
          className="text-sm font-medium text-primary hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}
