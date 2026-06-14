import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/contacts/status-badge";
import { ContactsFilters } from "@/components/contacts/contacts-filters";
import { ContactTableRow } from "@/components/contacts/contact-table-row";
import { Plus, ChevronLeft, ChevronRight, Users } from "lucide-react";

const PAGE_SIZE = 10;

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  tags: string[] | null;
  source: string | null;
  assigned_to: string | null;
  created_at: string;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    tag?: string;
    page?: string;
  }>;
}) {
  const { q, status, tag, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user's sub-account IDs
  const { data: roles } = await supabase
    .from("user_subaccount_roles")
    .select("subaccount_id")
    .eq("user_id", user.id);

  const subaccountIds = (roles || []).map(
    (r: { subaccount_id: string }) => r.subaccount_id
  );

  if (subaccountIds.length === 0) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Contacts</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              You don&apos;t have any workspaces yet. Create a sub-account to get
              started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch all unique tags for the filter dropdown
  const { data: allTagsData } = await supabase
    .from("contacts")
    .select("tags")
    .in("subaccount_id", subaccountIds);

  const availableTags = [
    ...new Set(
      (allTagsData || []).flatMap(
        (c: { tags: string[] | null }) => c.tags || []
      )
    ),
  ].sort();

  // Build query with filters
  let query = supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, status, tags, source, assigned_to, created_at",
      { count: "exact" }
    )
    .in("subaccount_id", subaccountIds);

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  // Pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: contacts, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const contactList = (contacts || []) as unknown as ContactRow[];
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Batch-fetch assignee names
  const assigneeIds = [
    ...new Set(
      contactList
        .map((c) => c.assigned_to)
        .filter(Boolean) as string[]
    ),
  ];

  let assigneeMap = new Map<string, string | null>();
  if (assigneeIds.length > 0) {
    const { data: assignees } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", assigneeIds);

    assigneeMap = new Map(
      (assignees || []).map(
        (a: { id: string; full_name: string | null }) => [a.id, a.full_name]
      )
    );
  }

  const hasFilters = !!(q || status || tag);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <Link
          href="/dashboard/contacts/new"
          className={buttonVariants({ className: "gap-1.5" })}
        >
          <Plus className="h-4 w-4" />
          Add Contact
        </Link>
      </div>

      <div className="mb-4">
        <Suspense>
          <ContactsFilters availableTags={availableTags} />
        </Suspense>
      </div>

      {contactList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {hasFilters
                ? "No contacts match your filters."
                : 'No contacts yet. Click "Add Contact" to create one.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Name</TableHead>
                  <TableHead className="px-4">Email</TableHead>
                  <TableHead className="px-4">Phone</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4">Tags</TableHead>
                  <TableHead className="px-4">Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactList.map((contact) => (
                  <ContactTableRow
                    key={contact.id}
                    contact={contact}
                    assigneeName={
                      contact.assigned_to
                        ? assigneeMap.get(contact.assigned_to)
                        : null
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {contactList.map((contact) => {
              const fullName =
                [contact.first_name, contact.last_name]
                  .filter(Boolean)
                  .join(" ") || "Unnamed";
              return (
                <Link
                  key={contact.id}
                  href={`/dashboard/contacts/${contact.id}`}
                >
                  <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{fullName}</span>
                        <StatusBadge status={contact.status} />
                      </div>
                      {contact.email && (
                        <p className="text-sm text-muted-foreground">
                          {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground">
                          {contact.phone}
                        </p>
                      )}
                      {(contact.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {contact.tags!.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
                {count !== null && ` (${count} total)`}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/dashboard/contacts?${buildPageUrl({ q, status, tag, page: page - 1 })}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/dashboard/contacts?${buildPageUrl({ q, status, tag, page: page + 1 })}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function buildPageUrl(params: {
  q?: string;
  status?: string;
  tag?: string;
  page: number;
}): string {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.tag) searchParams.set("tag", params.tag);
  searchParams.set("page", String(params.page));
  return searchParams.toString();
}
