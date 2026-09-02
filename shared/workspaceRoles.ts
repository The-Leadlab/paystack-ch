/**
 * Workspace member roles — owner is implicit (not stored on member docs).
 * Legacy `editor` → member, `viewer` → accountant.
 */
export type WorkspaceRole =
  | "owner"
  | "manager"
  | "member"
  | "accountant"
  | "editor"
  | "viewer";

export function normalizeWorkspaceRole(raw: unknown): WorkspaceRole {
  const r = String(raw || "").toLowerCase();
  if (r === "owner") return "owner";
  if (r === "manager") return "manager";
  if (r === "accountant" || r === "viewer") return "accountant";
  if (r === "member" || r === "editor") return "member";
  return "member";
}

export function workspaceRoleCanWrite(role: WorkspaceRole, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role === "manager" || role === "member";
}

export function workspaceRoleCanInvite(role: WorkspaceRole, isOwner: boolean): boolean {
  return isOwner || role === "manager";
}

/** Owner or manager — list team, revoke invites, remove members. */
export function workspaceRoleCanManageTeam(role: WorkspaceRole, isOwner: boolean): boolean {
  return isOwner || role === "manager";
}

export function workspaceRoleCanExport(role: WorkspaceRole, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role !== "owner";
}

export function parseWorkspaceInviteRole(raw: string): WorkspaceRole {
  const r = raw.toLowerCase();
  if (r === "accountant" || r === "viewer") return "accountant";
  if (r === "manager") return "manager";
  if (r === "member" || r === "editor") return "member";
  return "member";
}

export const WORKSPACE_WRITE_ROLE_VALUES = ["manager", "member", "editor"] as const;
