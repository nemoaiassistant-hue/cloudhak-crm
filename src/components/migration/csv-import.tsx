"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Upload, CheckCircle2, FileSpreadsheet, Download,
} from "lucide-react";

export function CSVImport({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; imported: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; preview: boolean } | null>(null);

  function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const rows = lines.slice(1).map((line) => {
      // Simple CSV split — handles quoted commas
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === "," && !inQuotes) { cells.push(current); current = ""; continue; }
        current += char;
      }
      cells.push(current);
      return cells;
    });
    return { headers, rows };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSV(text);
        setParsed({ headers, rows, preview: true });
      } catch {
        setError("Failed to parse CSV. Make sure it's a valid CSV file.");
      }
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);

    try {
      // Map CSV columns to contact fields
      const { headers, rows } = parsed;

      const findCol = (...names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));
      const fnIdx = findCol("first_name", "firstname", "first name", "given_name");
      const lnIdx = findCol("last_name", "lastname", "last name", "family_name", "surname");
      const emailIdx = findCol("email", "e-mail", "mail");
      const phoneIdx = findCol("phone", "mobile", "telephone", "tel");
      const tagsIdx = findCol("tags", "tag");

      const contacts = rows.map((row) => {
        const tagsStr = tagsIdx >= 0 ? row[tagsIdx] : "";
        return {
          subaccount_id: subaccountId,
          first_name: fnIdx >= 0 ? row[fnIdx]?.trim() || "" : "",
          last_name: lnIdx >= 0 ? row[lnIdx]?.trim() || "" : "",
          email: emailIdx >= 0 ? row[emailIdx]?.trim() || null : null,
          phone: phoneIdx >= 0 ? row[phoneIdx]?.trim() || null : null,
          tags: tagsStr ? tagsStr.split(";").map((t) => t.trim()).filter(Boolean) : [],
          source: "import" as const,
          status: "lead" as const,
        };
      }).filter((c) => c.first_name || c.last_name || c.email); // Skip empty rows

      let imported = 0;
      let failed = 0;

      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);
        const { error: insertError } = await supabase.from("contacts").insert(batch);
        if (insertError) {
          failed += batch.length;
        } else {
          imported += batch.length;
        }
      }

      setResult({ total: contacts.length, imported, failed });
      setParsed(null);
    } catch {
      setError("Import failed. Check your CSV format and try again.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = "first_name,last_name,email,phone,tags\nJohn,Smith,john@example.com,+447123456789,\"VIP;Newsletter\"\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cloudhak-contacts-template.csv";
    a.click();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          Import contacts from a CSV file. Column headers are auto-matched (first_name, last_name, email, phone, tags). Tags should be separated by semicolons.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-3.5 w-3.5" /> Download Template
            </Button>
          </div>

          <div className="space-y-2">
            <Label>CSV File</Label>
            <div className="rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFile}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Max 10,000 rows recommended</p>
              </label>
            </div>
          </div>

          {/* Preview */}
          {parsed && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">
                Preview: {parsed.rows.length} contacts found
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Detected columns: {parsed.headers.join(", ")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {parsed.headers.slice(0, 5).map((h) => (
                        <th key={h} className="text-left py-1 px-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {row.slice(0, 5).map((cell, j) => (
                          <td key={j} className="py-1 px-2">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={doImport} disabled={importing} className="mt-3 w-full">
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import {parsed.rows.length} Contacts
              </Button>
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Import complete!</p>
                <p className="text-xs text-muted-foreground">
                  {result.imported} imported, {result.failed} failed out of {result.total} total.
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
