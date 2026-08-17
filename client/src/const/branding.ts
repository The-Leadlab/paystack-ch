/**
 * In-app mark (diamond stack only) — favicon, emails, sidebars.
 * Master for icons: `client/public/brand/paystack-mark-master.png`
 * Full lockup (icon + PayStack.ch wordmark): `paystack-lockup.png`
 * On-dark variants invert charcoal ink, keep brand red.
 * After replacing sources: `node scripts/process-new-logo.mjs` then `pnpm assets:brand-icons`.
 * Keep in sync with `client/index.html` `<link rel="icon" ...>`.
 */
export const BRAND_LOGO_SRC = "/brand/paystack-mark-128.png" as const;
/** Intrinsic pixel size of `BRAND_LOGO_SRC` (square) for width/height on <img>. */
export const BRAND_LOGO_SIZE = 128 as const;

/** Horizontal lockup with transparent background (navbar / footer / auth, light chrome). */
export const BRAND_LOCKUP_SRC = "/brand/paystack-lockup.png" as const;
/** Display height hint for lockup (full-res asset is 967×258). */
export const BRAND_LOCKUP_HEIGHT = 258 as const;

/** Lockup for dark chrome (white wordmark, light plates, red kept). */
export const BRAND_LOCKUP_ON_DARK_SRC = "/brand/paystack-lockup-on-dark.png" as const;
/** Mark for dark chrome (full-res; 128px files stay for favicon). */
export const BRAND_MARK_ON_DARK_SRC = "/brand/paystack-mark-on-dark.png" as const;

export function brandLockupSrc(theme: "light" | "dark"): string {
  return theme === "dark" ? BRAND_LOCKUP_ON_DARK_SRC : BRAND_LOCKUP_SRC;
}

export function brandMarkSrc(theme: "light" | "dark"): string {
  return theme === "dark" ? BRAND_MARK_ON_DARK_SRC : "/brand/paystack-mark-master.png";
}
