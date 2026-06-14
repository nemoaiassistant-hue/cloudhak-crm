"use client";

import { useRouter } from "next/navigation";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";

interface ContactTableRowProps {
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    tags: string[] | null;
    assigned_to: string | null;
  };
  assigneeName?: string | null;
}

export function ContactTableRow({ contact, assigneeName }: ContactTableRowProps) {
  const router = useRouter();

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unnamed";

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
    >
      <TableCell className="px-4 font-medium">{fullName}</TableCell>
      <TableCell className="px-4 text-muted-foreground">
        {contact.email || "—"}
      </TableCell>
      <TableCell className="px-4 text-muted-foreground">
        {contact.phone || "—"}
      </TableCell>
      <TableCell className="px-4">
        <StatusBadge status={contact.status} />
      </TableCell>
      <TableCell className="px-4">
        <div className="flex flex-wrap gap-1">
          {(contact.tags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
          {(contact.tags || []).length > 3 && (
            <Badge variant="ghost" className="text-xs">
              +{(contact.tags || []).length - 3}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 text-muted-foreground">
        {contact.assigned_to ? assigneeName || "Assigned" : "—"}
      </TableCell>
    </TableRow>
  );
}
