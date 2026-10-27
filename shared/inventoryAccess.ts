/**
 * Inventory feature unlock (full interactive stock).
 *
 * The Inventory nav tab is visible to everyone with a Coming Soon / blurred
 * teaser. Full read/write unlock is **Ali + Damien only** for now.
 */

import { PERSONAL_DEV_ADMIN_EMAIL } from "./personalProductAccess.js";

export const INVENTORY_DEV_EMAILS = [
  PERSONAL_DEV_ADMIN_EMAIL,
  "damien@the-leadlab.com",
] as const;

/** @deprecated Kept for call-site compatibility; unlock ignores these opts. */
export type InventoryAccessOpts = {
  inventoryBeta?: boolean;
  ukUatActive?: boolean;
  adminAppAccess?: boolean;
  envEnabled?: boolean;
  extraEmails?: string[];
};

export function isInventoryAllowedForUser(
  email: string | null | undefined,
  _opts: InventoryAccessOpts = {},
): boolean {
  const lower = email?.toLowerCase().trim();
  if (!lower) return false;
  return INVENTORY_DEV_EMAILS.some((e) => e.toLowerCase() === lower);
}
