/**
 * Inventory feature gate.
 *
 * Hidden from normal users until promoted. Access is granted when any of:
 *   1. VITE_INVENTORY_ENABLED=true (master switch for Damien's demo week)
 *   2. Email is on the built-in / VITE_INVENTORY_EMAILS allowlist
 *   3. users/{uid}.inventoryBeta === true
 *   4. Admin app-access user
 *   5. UK UAT (`/admin-uk`) — Louise tests the same flag there
 */

import { PERSONAL_DEV_ADMIN_EMAIL } from "./personalProductAccess.js";

const BUILT_IN_INVENTORY_EMAILS = [PERSONAL_DEV_ADMIN_EMAIL];

export type InventoryAccessOpts = {
  inventoryBeta?: boolean;
  ukUatActive?: boolean;
  adminAppAccess?: boolean;
  envEnabled?: boolean;
  extraEmails?: string[];
};

function readViteEnv(name: string): string {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return String(env?.[name] ?? "");
  } catch {
    return "";
  }
}

export function readInventoryEnv(): { enabled: boolean; extraEmails: string[] } {
  const flag = readViteEnv("VITE_INVENTORY_ENABLED").toLowerCase();
  const extraEmails = readViteEnv("VITE_INVENTORY_EMAILS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { enabled: flag === "true" || flag === "1", extraEmails };
}

export function isInventoryEnabled(envEnabled?: boolean): boolean {
  if (typeof envEnabled === "boolean") return envEnabled;
  return readInventoryEnv().enabled;
}

export function isInventoryAllowedForUser(
  email: string | null | undefined,
  opts: InventoryAccessOpts = {}
): boolean {
  if (opts.ukUatActive) return true;
  if (opts.inventoryBeta) return true;
  if (opts.adminAppAccess) return true;
  if (isInventoryEnabled(opts.envEnabled)) return true;

  const lower = email?.toLowerCase().trim();
  if (!lower) return false;

  if (BUILT_IN_INVENTORY_EMAILS.some((e) => e.toLowerCase() === lower)) return true;

  const extras = opts.extraEmails ?? readInventoryEnv().extraEmails;
  return extras.includes(lower);
}
