/**
 * Personal product launch gate.
 *
 * When `PERSONAL_PRODUCT_PUBLICLY_AVAILABLE` is false:
 * - Landing / pricing / modules must not promote Personal
 * - Stripe checkout must reject `planId === "personal"`
 * - `/personal` is only for allowlisted emails (dev admin while testing)
 *
 * Flip to true only after explicit product approval to re-promote Personal.
 */
export const PERSONAL_PRODUCT_PUBLICLY_AVAILABLE = false;

/** Sole built-in email that may use Personal while it is not publicly available. */
export const PERSONAL_DEV_ADMIN_EMAIL = "ali@the-leadlab.com";

export function isPersonalDevAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return normalized === PERSONAL_DEV_ADMIN_EMAIL;
}
