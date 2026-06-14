import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Inbox } from "lucide-react";

export default async function FormSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, fields")
    .eq("id", id)
    .single();

  if (!form) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Form not found.</p>
        <Link href="/dashboard/forms"><Button variant="link">← Back</Button></Link>
      </div>
    );
  }

  const { data: submissions } = await supabase
    .from("form_submissions")
    .select("id, data, contact_id, created_at, ip_address")
    .eq("form_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const fields = form.fields as { key: string; label: string }[];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/dashboard/forms/${id}`} className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> {form.name}
          </Link>
        </div>
        <h1 className="text-xl font-bold">Submissions ({submissions?.length || 0})</h1>
      </div>

      {submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((sub: { id: string; data: Record<string, string>; contact_id: string | null; created_at: string; ip_address: string | null }) => (
            <Card key={sub.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {new Date(sub.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </CardTitle>
                  {sub.contact_id && (
                    <Badge variant="outline" className="text-xs">Contact created</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <span className="text-muted-foreground">{field.label}:</span>{" "}
                      <span className="font-medium">{sub.data?.[field.key] || "—"}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No submissions yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
