"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/search/global-search";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Building2, ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS, type Role } from "@/lib/rbac/permissions";

export function TopBar({ subaccountId }: { subaccountId?: string }) {
  const [user, setUser] = useState<{ email: string; full_name: string | null } | null>(null);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("viewer");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", user.id)
        .single();
      if (profile) setUser(profile);

      const stored = localStorage.getItem("active-subaccount");
      if (stored) {
        const { data: roleData } = await supabase
          .from("user_subaccount_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("subaccount_id", stored)
          .single();
        if (roleData) setRole(roleData.role as Role);
      }
    }
    load();
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-md md:px-6">
      {/* Left: Logo on mobile */}
      <div className="flex items-center gap-2 md:hidden">
        <Building2 className="h-5 w-5 text-primary" />
        <span className="font-bold">CloudHak</span>
      </div>

      {/* Center-left: spacer for desktop */}
      <div className="hidden md:block" />

      {/* Right: Search + Notifications + Theme + User */}
      <div className="flex items-center gap-2 md:gap-3">
        <GlobalSearch subaccountId={subaccountId} />
        <NotificationCenter userId={userId} />
        <ThemeToggle />

        {/* User Menu */}
        <div className="ml-1 border-l pl-2 md:pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {ROLE_LABELS[role]}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
