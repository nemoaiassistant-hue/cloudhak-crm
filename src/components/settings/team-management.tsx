"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, Mail } from "lucide-react";

interface TeamMember {
  role_id: string;
  role: string;
  user_id: string;
  email: string;
  full_name: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  staff: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export function TeamManagement({
  members,
  subaccountId,
}: {
  members: TeamMember[];
  subaccountId: string;
}) {
  const supabase = createClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(members);

  async function changeRole(roleId: string, newRole: string) {
    const { error } = await supabase
      .from("user_subaccount_roles")
      .update({ role: newRole })
      .eq("id", roleId);

    if (!error) {
      setLocalMembers((prev) =>
        prev.map((m) => (m.role_id === roleId ? { ...m, role: newRole } : m))
      );
    }
  }

  async function removeMember(roleId: string) {
    if (!confirm("Remove this team member?")) return;
    const { error } = await supabase
      .from("user_subaccount_roles")
      .delete()
      .eq("id", roleId);
    if (!error) {
      setLocalMembers((prev) => prev.filter((m) => m.role_id !== roleId));
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);

    // Check if user exists by email
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("email", inviteEmail.trim().toLowerCase())
      .single();

    if (!existingUser) {
      setMessage(
        "⚠️ User not found. They need to create an account first at the signup page."
      );
      setInviting(false);
      return;
    }

    // Check if already a member
    const alreadyMember = localMembers.some((m) => m.user_id === existingUser.id);
    if (alreadyMember) {
      setMessage("⚠️ This user is already a team member.");
      setInviting(false);
      return;
    }

    // Assign role
    const { error } = await supabase.from("user_subaccount_roles").insert({
      user_id: existingUser.id,
      subaccount_id: subaccountId,
      role: inviteRole,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setLocalMembers((prev) => [
        ...prev,
        {
          role_id: crypto.randomUUID(),
          role: inviteRole,
          user_id: existingUser.id,
          email: existingUser.email,
          full_name: existingUser.full_name,
        },
      ]);
      setShowInvite(false);
      setInviteEmail("");
      setMessage("✅ Team member added");
    }
    setInviting(false);
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>Manage who has access to this workspace</CardDescription>
        </div>
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogTrigger>
            <Button variant="outline" size="sm">
              <UserPlus className="mr-1 h-4 w-4" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                The user must have an existing account. Enter their email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v ?? "staff")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Full access</SelectItem>
                    <SelectItem value="manager">Manager — Manage contacts & tasks</SelectItem>
                    <SelectItem value="staff">Staff — Own contacts & tasks</SelectItem>
                    <SelectItem value="viewer">Viewer — Read only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button onClick={inviteMember} disabled={inviting}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {message && (
          <div className="mb-4 rounded-md bg-muted p-3 text-sm">{message}</div>
        )}
        {localMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No team members yet.
          </p>
        ) : (
          <div className="space-y-2">
            {localMembers.map((member) => {
              const initials = (member.full_name || member.email)
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div
                  key={member.role_id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.full_name || "Unnamed"}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(v: string | null) => { if (v) changeRole(member.role_id, v); }}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.role_id)}
                      className="text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
