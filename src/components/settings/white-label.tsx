"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Palette, Building2, Upload, Check } from "lucide-react";

interface Branding {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  app_name?: string;
  custom_domain?: string;
  login_bg_url?: string;
  sidebar_text?: string;
}

export function WhiteLabelSettings({
  subaccountId,
  initialBranding,
  subaccountName,
}: {
  subaccountId: string;
  initialBranding: Branding;
  subaccountName: string;
}) {
  const supabase = createClient();
  const [branding, setBranding] = useState<Branding>(initialBranding || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(key: keyof Branding, value: string) {
    setBranding((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("sub_accounts")
      .update({ branding })
      .eq("id", subaccountId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const previewStyle = {
    "--brand-primary": branding.primary_color || "#6366f1",
    "--brand-secondary": branding.secondary_color || "#8b5cf6",
  } as React.CSSProperties;

  return (
    <Tabs defaultValue="appearance">
      <TabsList>
        <TabsTrigger value="appearance"><Palette className="mr-1 h-3.5 w-3.5" /> Appearance</TabsTrigger>
        <TabsTrigger value="branding"><Building2 className="mr-1 h-3.5 w-3.5" /> Branding</TabsTrigger>
        <TabsTrigger value="domain"><Building2 className="mr-1 h-3.5 w-3.5" /> Domain</TabsTrigger>
      </TabsList>

      {/* Appearance */}
      <TabsContent value="appearance" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Color Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.primary_color || "#6366f1"}
                    onChange={(e) => update("primary_color", e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <Input
                    value={branding.primary_color || "#6366f1"}
                    onChange={(e) => update("primary_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.secondary_color || "#8b5cf6"}
                    onChange={(e) => update("secondary_color", e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <Input
                    value={branding.secondary_color || "#8b5cf6"}
                    onChange={(e) => update("secondary_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Color Presets</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { name: "Indigo", primary: "#6366f1", secondary: "#8b5cf6" },
                  { name: "Emerald", primary: "#10b981", secondary: "#059669" },
                  { name: "Rose", primary: "#f43f5e", secondary: "#e11d48" },
                  { name: "Amber", primary: "#f59e0b", secondary: "#d97706" },
                  { name: "Blue", primary: "#3b82f6", secondary: "#2563eb" },
                  { name: "Teal", primary: "#14b8a6", secondary: "#0d9488" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      update("primary_color", preset.primary);
                      update("secondary_color", preset.secondary);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden" style={previewStyle}>
              {/* Mini sidebar */}
              <div className="flex">
                <div className="w-12 bg-gray-900 p-2 flex flex-col gap-2">
                  <div className="h-8 w-8 rounded" style={{ background: branding.primary_color || "#6366f1" }} />
                  <div className="h-6 w-6 rounded bg-gray-700" />
                  <div className="h-6 w-6 rounded bg-gray-700" />
                  <div className="h-6 w-6 rounded bg-gray-700" />
                </div>
                <div className="flex-1 p-3 bg-background">
                  <div className="h-3 w-20 rounded bg-muted mb-2" />
                  <div className="h-8 w-24 rounded text-white text-[10px] flex items-center justify-center" style={{ background: branding.primary_color || "#6366f1" }}>
                    Button
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Branding */}
      <TabsContent value="branding" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>App Name (shown in sidebar + browser tab)</Label>
              <Input
                placeholder={subaccountName}
                value={branding.app_name || ""}
                onChange={(e) => update("app_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={branding.logo_url || ""}
                  onChange={(e) => update("logo_url", e.target.value)}
                />
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              {branding.logo_url && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/30">
                  <img src={branding.logo_url} alt="Logo preview" className="h-12 object-contain" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Sidebar Label Text</Label>
              <Input
                placeholder="Powered by CloudHak"
                value={branding.sidebar_text || ""}
                onChange={(e) => update("sidebar_text", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Domain */}
      <TabsContent value="domain" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Custom Domain</Label>
              <Input
                placeholder="crm.yourclinic.com"
                value={branding.custom_domain || ""}
                onChange={(e) => update("custom_domain", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Add a CNAME record pointing to <code className="text-xs bg-muted px-1 rounded">cname.vercel-dns.com</code> to connect your domain.
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              <p className="font-medium mb-1">📋 Setup steps:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-blue-800">
                <li>Add CNAME record in your DNS provider</li>
                <li>Save your custom domain here</li>
                <li>Contact your admin to verify in Vercel dashboard</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Save bar */}
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save Branding
        </Button>
        {saved && <Badge className="bg-green-500"><Check className="mr-0.5 h-3 w-3" /> Saved</Badge>}
      </div>
    </Tabs>
  );
}
