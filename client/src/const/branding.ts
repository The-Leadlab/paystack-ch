/**
 * In-app mark (diamond stack only) — favicon, emails, sidebars.
 * Master for icons: `client/public/brand/paystack-mark-master.png`
 * Full lockup (icon + PayStack.ch wordmark): `paystack-lockup.png`
 * After replacing sources: `node scripts/process-new-logo.mjs` then `pnpm assets:brand-icons`.
 * Keep in sync with `client/index.html` `<link rel="icon" ...>`.
 */
export const BRAND_LOGO_SRC = "/brand/paystack-mark-128.png" as const;
/** Intrinsic pixel size of `BRAND_LOGO_SRC` (square) for width/height on <img>. */
export const BRAND_LOGO_SIZE = 128 as const;

/** Horizontal lockup with transparent background (navbar / footer / auth). */
export const BRAND_LOCKUP_SRC = "/brand/paystack-lockup-128.png" as const;
/** Display height hint for lockup (asset is ~height 128). */
export const BRAND_LOCKUP_HEIGHT = 128 as const;
