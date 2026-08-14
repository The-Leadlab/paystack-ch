# Paystack.ch — Brand Logo + Landing Screenshots Super Prompt

Use this when replacing the **PayStack.ch** diamond-stack logo, regenerating favicons/icons, or refreshing marketing screenshots so the landing page matches the live product chrome.

**Surfaces:** `/` (landing Navbar/Footer/Hero/tour), `/sign-in` & auth shells, `/admin`, `/app` sidebar + mobile header, `/personal` / Ali personal sidebar, invoice preview, report emails, favicon + JSON-LD.

---

## Brand assets (source of truth)

| File | Role |
|------|------|
| `client/public/brand/paystack-final-logo.png` | Transparent **lockup** master (icon + PayStack.ch wordmark) |
| `client/public/brand/paystack-lockup.png` | Same lockup (full res) |
| `client/public/brand/paystack-lockup-128.png` | Navbar / Footer / Auth (`BrandLogo` with wordmark) |
| `client/public/brand/paystack-mark-master.png` | Transparent **icon-only** square (diamond stack) |
| `client/public/brand/paystack-mark-128.png` | Favicon, emails, `/app` sidebar mark |
| `client/public/brand/paystack-icon-192.png` / `paystack-icon-512.png` | PWA / large icons |

**Constants:** `client/src/const/branding.ts` — `BRAND_LOGO_SRC` (mark), `BRAND_LOCKUP_SRC` (lockup).  
**Component:** `client/src/components/BrandLogo.tsx` — `showWordmark` selects lockup vs mark; **never** render a CSS wordmark on top of the lockup (would duplicate “PayStack.ch”).  
**HTML:** `client/index.html` favicon + Organization `logo` → `/brand/paystack-mark-128.png`.  
**Emails:** `shared/brandAssets.ts` → `BRAND_LOGO_PATH`.

---

## Replace artwork

1. Drop the designer file (JPEG/PNG, white background OK) somewhere reachable.
2. Process (removes near-white background, writes lockup + mark master + sized icons):

```bash
node scripts/process-new-logo.mjs path/to/source.png
pnpm assets:brand-icons
```

3. Smoke-check:
   - Lockup on **light** marketing (`/`) — black “PayStack” + red “.ch” must read clearly.
   - Mark alone on **dark** `/app` sidebar — diamond stack only (no black wordmark on charcoal).
   - Favicon in the browser tab.

---

## Landing screenshots

| Key | File under `client/public/landing/` |
|-----|-------------------------------------|
| dashboard | `screenshot-dashboard-v4.jpg` |
| revenue | `screenshot-revenue-v4.jpg` |
| expenses | `screenshot-expenses-v4.jpg` |
| reports | `screenshot-reports-v4.jpg` |
| documents | `screenshot-documents-v4.jpg` |
| personal | `screenshot-personal-v4.jpg` |

Mapped in `client/src/const/landingScreens.ts`. **Bump the filename suffix** (v4 → v5…) whenever you replace pixels so CDN/browser caches refresh.

### Regenerate from app chrome PNGs

1. Capture (or drop) 1536×1024 product shots into `tmp-landing-v3/` as `dashboard.png`, `revenue.png`, `expenses.png`, `reports.png`, `documents.png`, `personal.png`.
2. Ensure brand mark is current (`paystack-mark-128.png`).
3. Patch old red-bar / prior mark in the sidebar slot:

```bash
node scripts/patch-landing-logos.mjs
```

4. Confirm Hero / Platform tour / Modules sections show the new files (hard-refresh).

**Rule:** Landing imagery must show the **same diamond-stack mark** as `/app`. Do not leave the legacy three red horizontal bars in marketing shots.

---

## Checklist

- [ ] Transparent lockup + mark masters updated
- [ ] `pnpm assets:brand-icons` run
- [ ] `BrandLogo` lockup on Navbar/Footer/Auth; mark on compact/admin/favicon
- [ ] `/app` + personal sidebars use `BRAND_LOGO_SRC`
- [ ] Landing `LANDING_SCREENSHOTS` paths point at new vN files
- [ ] Favicon + JSON-LD still `/brand/paystack-mark-128.png`
- [ ] Commit brand PNGs + screenshot JPGs + code; push

---

## Out of scope

- Open Banking / live bank sync branding
- Promoting Ali lab features into `/app`
- Generating fake product UI that does not match current dashboard chrome
