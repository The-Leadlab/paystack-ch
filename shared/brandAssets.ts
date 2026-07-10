/** Paystack.ch brand tokens — shared by marketing UI and server-rendered emails. */
export const BRAND_COLORS = {
  charcoal: "#2B2B2B",
  red: "#E8423F",
  redLight: "#F26A67",
  cream: "#FFF5F4",
  muted: "#6F6669",
  white: "#FFFFFF",
  border: "#E8E2E0",
} as const;

/** Public path (append to site origin). */
export const BRAND_LOGO_PATH = "/brand/paystack-mark-128.png" as const;

export function resolveBrandLogoUrl(siteOrigin?: string): string {
  const base = (siteOrigin || process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_SITE_URL || "https://www.paystack.ch")
    .trim()
    .replace(/\/$/, "");
  return `${base}${BRAND_LOGO_PATH}`;
}
