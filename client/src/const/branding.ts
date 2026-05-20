/**
 * In-app / marketing logo URL (128×128 PNG ~3KB; full master is ~80KB).
 * Master source for generation: `client/public/brand/paystack-final-logo.png` — run `pnpm assets:brand-icons` after replacing it.
 * Keep in sync with `client/index.html` `<link rel="icon" ...>`.
 */
export const BRAND_LOGO_SRC = "/brand/paystack-mark-128.png" as const;
/** Intrinsic pixel size of `BRAND_LOGO_SRC` (square) for width/height on <img>. */
export const BRAND_LOGO_SIZE = 128 as const;
