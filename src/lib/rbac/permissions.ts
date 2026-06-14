/**
 * RBAC Permission Matrix
 *
 * Roles (hierarchy): admin > manager > staff > viewer
 *
 * admin   — full access (settings, team, billing, delete, API keys)
 * manager — manage contacts, pipelines, forms, automations, calendar (no team/billing)
 * staff   — create/edit contacts, tasks, notes (no delete, no settings)
 * viewer  — read-only access everywhere
 */

export type Role = "admin" | "manager" | "staff" | "viewer";

export type Permission =
  | "contacts.view"
  | "contacts.create"
  | "contacts.edit"
  | "contacts.delete"
  | "contacts.export"
  | "pipelines.view"
  | "pipelines.manage"
  | "calendar.view"
  | "calendar.manage"
  | "forms.view"
  | "forms.manage"
  | "inbox.view"
  | "inbox.reply"
  | "automations.view"
  | "automations.manage"
  | "tasks.view"
  | "tasks.manage"
  | "reports.view"
  | "settings.view"
  | "settings.org"
  | "settings.team"
  | "settings.api_keys"
  | "settings.branding"
  | "settings.comms"
  | "settings.audit"
  | "settings.gdpr"
  | "migrate.view"
  | "migrate.run";

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  manager: 3,
  staff: 2,
  viewer: 1,
};

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  admin: [
    // Admin gets everything
    "contacts.view", "contacts.create", "contacts.edit", "contacts.delete", "contacts.export",
    "pipelines.view", "pipelines.manage",
    "calendar.view", "calendar.manage",
    "forms.view", "forms.manage",
    "inbox.view", "inbox.reply",
    "automations.view", "automations.manage",
    "tasks.view", "tasks.manage",
    "reports.view",
    "settings.view", "settings.org", "settings.team", "settings.api_keys",
    "settings.branding", "settings.comms", "settings.audit", "settings.gdpr",
    "migrate.view", "migrate.run",
  ],
  manager: [
    "contacts.view", "contacts.create", "contacts.edit", "contacts.delete", "contacts.export",
    "pipelines.view", "pipelines.manage",
    "calendar.view", "calendar.manage",
    "forms.view", "forms.manage",
    "inbox.view", "inbox.reply",
    "automations.view", "automations.manage",
    "tasks.view", "tasks.manage",
    "reports.view",
    "settings.view", "settings.branding", "settings.comms",
    "migrate.view", "migrate.run",
  ],
  staff: [
    "contacts.view", "contacts.create", "contacts.edit",
    "pipelines.view",
    "calendar.view", "calendar.manage",
    "forms.view",
    "inbox.view", "inbox.reply",
    "automations.view",
    "tasks.view", "tasks.manage",
    "reports.view",
    "settings.view",
  ],
  viewer: [
    "contacts.view",
    "pipelines.view",
    "calendar.view",
    "forms.view",
    "inbox.view",
    "automations.view",
    "tasks.view",
    "reports.view",
    "settings.view",
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role | null | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}

export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY[role] || 0;
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  // You can only manage users with equal or lower roles
  return getRoleLevel(actorRole) >= getRoleLevel(targetRole);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access — settings, team, billing, API keys, delete",
  manager: "Manage contacts, pipelines, forms, automations. No team or billing.",
  staff: "Create and edit contacts, tasks, notes. No delete or settings.",
  viewer: "Read-only access to everything.",
};

export const ALL_ROLES: Role[] = ["admin", "manager", "staff", "viewer"];
