/**
 * Inventory feature unlock (full interactive stock).
 *
 * The Inventory nav tab is visible to everyone with a Coming Soon / blurred
 * teaser. Full read/write unlock is granted when any of:
 *   1. Email is on the built-in allowlist (Ali, Damien, Louise)
 *   2. Email is on opts.extraEmails (e.g. VITE_INVENTORY_EMAILS from the client hook)
 *   3. UK UAT (`/admin-uk`) — GBP sandbox stock testing
 *   4. users/{uid}.inventoryBeta === true (opts.inventoryBeta)
 *   5. Admin app-access user (opts.adminAppAccess)
 *   6. Master env switch (opts.envEnabled / VITE_INVENTORY_ENABLED)
 */

import { PERSONAL_DEV_ADMIN_EMAIL } from "./personalProductAccess.js";

export const INVENTORY_DEV_EMAILS = [
  PERSONAL_DEV_ADMIN_EMAIL,
  "damien@the-leadlab.com",
  /** UK + CHF stock UAT tester */
  "louise@the-leadlab.com",
] as const;

export type InventoryAccessOpts = {
  inventoryBeta?: boolean;
  ukUatActive?: boolean;
  adminAppAccess?: boolean;
  envEnabled?: boolean;
  extraEmails?: string[];
};

export function isInventoryAllowedForUser(
  email: string | null | undefined,
  opts: InventoryAccessOpts = {},
): boolean {
  if (opts.ukUatActive) return true;
  if (opts.envEnabled) return true;
  if (opts.adminAppAccess) return true;
  if (opts.inventoryBeta) return true;

  const lower = email?.toLowerCase().trim();
  if (!lower) return false;

  if (INVENTORY_DEV_EMAILS.some((e) => e.toLowerCase() === lower)) return true;

  const extras = (opts.extraEmails ?? [])
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  return extras.includes(lower);
}
