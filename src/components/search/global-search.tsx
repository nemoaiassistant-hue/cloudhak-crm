"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, User, Filter, FileText, CheckSquare, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "contact" | "opportunity" | "form" | "task";
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_ICONS = {
  contact: User,
  opportunity: Filter,
  form: FileText,
  task: CheckSquare,
};

const TYPE_LABELS = {
  contact: "Contact",
  opportunity: "Deal",
  form: "Form",
  task: "Task",
};

export function GlobalSearch({ subaccountId }: { subaccountId?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const lowerQ = q.toLowerCase();

      if (!subaccountId) {
        setResults([]);
        setLoading(false);
        return;
      }

      const [contacts, deals, forms, tasks] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .eq("subaccount_id", subaccountId)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5),
        supabase
          .from("opportunities")
          .select("id, title, value, currency")
          .eq("subaccount_id", subaccountId)
          .ilike("title", `%${q}%`)
          .limit(3),
        supabase
          .from("forms")
          .select("id, name")
          .eq("subaccount_id", subaccountId)
          .ilike("name", `%${q}%`)
          .limit(3),
        supabase
          .from("tasks")
          .select("id, title, priority")
          .eq("subaccount_id", subaccountId)
          .ilike("title", `%${q}%`)
          .limit(3),
      ]);

      const allResults: SearchResult[] = [
        ...(contacts.data || []).map((c) => ({
          id: c.id,
          type: "contact" as const,
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.email || c.phone || "",
          href: `/dashboard/contacts/${c.id}`,
        })),
        ...(deals.data || []).map((d) => ({
          id: d.id,
          type: "opportunity" as const,
          title: d.title,
          subtitle: `£${d.value} ${d.currency}`,
          href: `/dashboard/pipelines`,
        })),
        ...(forms.data || []).map((f) => ({
          id: f.id,
          type: "form" as const,
          title: f.name,
          subtitle: "Form",
          href: `/dashboard/forms/${f.id}`,
        })),
        ...(tasks.data || []).map((t) => ({
          id: t.id,
          type: "task" as const,
          title: t.title,
          subtitle: `${t.priority} priority`,
          href: `/dashboard/tasks`,
        })),
      ];

      setResults(allResults);
      setLoading(false);
    }, 200);

    return () => clearTimeout(debounce);
  }, [query, subaccountId, supabase]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search contacts, deals, forms..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-lg border bg-background pl-9 pr-8 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && (query.trim().length >= 2) && (
        <div className="absolute top-full mt-1 w-full rounded-lg border bg-popover shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">No results found.</div>
          )}
          {!loading && results.map((r) => {
            const Icon = TYPE_ICONS[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => navigate(r.href)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b last:border-0"
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {TYPE_LABELS[r.type]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
