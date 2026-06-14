"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Settings,
  Calendar,
  CheckSquare,
  MessageSquare,
  Filter,
  KeyRound,
  ChevronDown,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Pipelines", href: "/dashboard/pipelines", icon: Filter },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Inbox", href: "/dashboard/inbox", icon: MessageSquare },
];

const SETTINGS_ITEMS: NavItem[] = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "API Keys", href: "/dashboard/settings/api-keys", icon: KeyRound },
];

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{
    email: string;
    full_name: string | null;
  } | null>(null);
  const [subAccounts, setSubAccounts] = useState<
    Array<{ id: string; name: string; slug: string; role: string }>
  >([]);
  const [activeSubAccount, setActiveSubAccount] = useState<string>("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", user.id)
        .single();
      if (profile) setUser(profile);

      const { data: roles } = await supabase
        .from("user_subaccount_roles")
        .select("subaccount_id, role, sub_accounts(id, name, slug)")
        .eq("user_id", user.id);

      if (roles && roles.length > 0) {
        const accounts = roles.map((r: Record<string, unknown>) => {
          const sa = r.sub_accounts as Record<string, unknown>;
          return {
            id: sa.id as string,
            name: sa.name as string,
            slug: sa.slug as string,
            role: r.role as string,
          };
        });
        setSubAccounts(accounts);
        const stored = localStorage.getItem("active-subaccount");
        if (stored && accounts.some((a) => a.id === stored)) {
          setActiveSubAccount(stored);
        } else {
          setActiveSubAccount(accounts[0].id);
          localStorage.setItem("active-subaccount", accounts[0].id);
        }
      }
    }
    load();
  }, []);

  function switchSubAccount(id: string) {
    setActiveSubAccount(id);
    localStorage.setItem("active-subaccount", id);
    window.location.reload();
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">CloudHak CRM</span>
      </div>

      {/* Sub-Account Switcher */}
      {subAccounts.length > 0 && (
        <div className="border-b p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
              <span className="truncate font-medium">
                {subAccounts.find((a) => a.id === activeSubAccount)?.name ||
                  "Select workspace"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full" align="start">
              {subAccounts.map((account) => (
                <DropdownMenuItem
                  key={account.id}
                  onClick={() => switchSubAccount(account.id)}
                  className="flex items-center justify-between"
                >
                  <span>{account.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {account.role}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="my-3 border-t" />

        {SETTINGS_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-medium">
                {user?.full_name || user?.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full" align="start">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
