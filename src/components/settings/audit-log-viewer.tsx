"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Search } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  users: unknown;
}

export function AuditLogViewer({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    async function fetchAudit() {
      setLoading(true);
      let query = supabase
        .from("audit_log")
        .select(`
          id, action, entity_type, entity_id, changes, ip_address, created_at,
          users ( email, full_name )
        `)
        .eq("subaccount_id", subaccountId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      const { data } = await query;
      setEntries((data || []) as unknown as AuditEntry[]);
      setLoading(false);
    }
    fetchAudit();
  }, [subaccountId, filterAction, supabase]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const u = Array.isArray(e.users) ? e.users[0] : e.users as { email?: string; full_name?: string } | null;
    return (
      e.action.toLowerCase().includes(q) ||
      e.entity_type.toLowerCase().includes(q) ||
      u?.email?.toLowerCase().includes(q) ||
      u?.full_name?.toLowerCase().includes(q)
    );
  });

  const ACTION_COLORS: Record<string, string> = {
    create: "bg-green-500",
    update: "bg-blue-500",
    delete: "bg-red-500",
    login: "bg-purple-500",
    export: "bg-amber-500",
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit log..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterAction} onValueChange={(v) => v && setFilterAction(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="export">Export</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No audit entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Entity</th>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">IP</th>
                    <th className="text-left p-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${ACTION_COLORS[entry.action] || "bg-gray-400"}`} />
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-mono">{entry.entity_type}</span>
                        {entry.entity_id && (
                          <span className="text-xs text-muted-foreground ml-1">
                            #{entry.entity_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {(() => {
                          const u = entry.users;
                          if (!u) return <span className="text-xs text-muted-foreground">System</span>;
                          const user = Array.isArray(u) ? u[0] : u;
                          return <span className="text-xs">{user?.full_name || user?.email || "Unknown"}</span>;
                        })()}
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground font-mono">
                          {entry.ip_address || "—"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
