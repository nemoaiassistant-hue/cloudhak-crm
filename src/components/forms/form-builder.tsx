"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, Loader2, ArrowUp, ArrowDown } from "lucide-react";

interface FormField {
  type: string;
  label: string;
  key: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "textarea", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

export function FormBuilder({
  formId,
  initialName,
  initialFields,
}: {
  formId: string;
  initialName: string;
  initialFields: FormField[];
}) {
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addField() {
    const key = `field_${Date.now()}`;
    setFields([...fields, { type: "text", label: "New Field", key, required: false }]);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  function moveField(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  }

  function updateField(index: number, updates: Partial<FormField>) {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("forms")
      .update({ name, fields: fields as unknown as Record<string, unknown>[] })
      .eq("id", formId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div>
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="space-y-2">
              <Label>Form Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Fields</h3>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1 h-4 w-4" /> Add Field
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col pt-8">
                    <button
                      onClick={() => moveField(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => moveField(i, 1)}
                      disabled={i === fields.length - 1}
                      className="text-muted-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        placeholder="Field label"
                        className="flex-1"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(v: string | null) => v && updateField(i, { type: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={field.key}
                        onChange={(e) => updateField(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })}
                        placeholder="field_key"
                        className="text-xs font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(v) => updateField(i, { required: v })}
                        />
                        <span className="text-xs text-muted-foreground">Required</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeField(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    {(field.type === "select") && (
                      <Input
                        value={(field.options || []).join(", ")}
                        onChange={(e) => updateField(i, { options: e.target.value.split(",").map((o) => o.trim()) })}
                        placeholder="Option 1, Option 2, Option 3"
                        className="text-xs"
                      />
                    )}
                    {field.type !== "checkbox" && field.type !== "select" && (
                      <Input
                        value={field.placeholder || ""}
                        onChange={(e) => updateField(i, { placeholder: e.target.value })}
                        placeholder="Placeholder text"
                        className="text-xs"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save Form
          </Button>
          {saved && <span className="text-sm text-green-600">✅ Saved</span>}
        </div>
      </div>

      {/* Live Preview */}
      <div>
        <h3 className="mb-3 font-semibold">Live Preview</h3>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, i) => (
              <div key={i} className="space-y-1">
                <Label className="text-sm">
                  {field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {field.type === "textarea" ? (
                  <textarea
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    placeholder={field.placeholder}
                    rows={3}
                    disabled
                  />
                ) : field.type === "select" ? (
                  <select className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" disabled>
                    <option>Select...</option>
                    {(field.options || []).map((opt, j) => (
                      <option key={j}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled className="rounded" />
                    <span className="text-sm text-muted-foreground">{field.placeholder || "Check to confirm"}</span>
                  </div>
                ) : (
                  <Input
                    type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    placeholder={field.placeholder}
                    disabled
                  />
                )}
              </div>
            ))}
            <Button className="w-full" disabled>
              Submit
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
