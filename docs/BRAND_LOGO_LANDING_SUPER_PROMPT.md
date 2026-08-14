# Paystack.ch — Brand Logo + Landing Screenshots Super Prompt

Use this when replacing the **PayStack.ch** diamond-stack logo, generating the **on-dark (inverted) pair**, regenerating favicons/icons, or refreshing marketing screenshots so the landing page matches live product chrome.

**Surfaces:** `/` (landing Navbar/Footer/Hero/tour), `/sign-in` & auth shells, `/admin`, `/app` sidebar + mobile header, `/personal` sidebar, invoice preview (light paper), report emails, favicon + JSON-LD.

---

## Two lockups (required)

The artwork is charcoal + red. On dark chrome the wordmark and middle plate disappear. Always ship **both**:

| Variant | When | Files |
|---------|------|--------|
| **On-light** | Light navbar, light `/app` sidebar (`cafe-theme-light`), light personal shots, invoices, emails | `paystack-lockup.png`, `paystack-lockup-128.png`, `paystack-mark-128.png` |
| **On-dark** | Dark theme (`html.dark`, `cafe-theme-dark`), `/app` default | `paystack-lockup-on-dark.png`, `paystack-lockup-on-dark-128.png`, `paystack-mark-on-dark-128.png` |

**On-dark rule:** invert near-neutral ink (black → white, charcoal plates → light grey). **Keep brand red** (top plate + `.ch`). Transparent background. Never bake a black or white rectangle behind the lockup.

**Code:** `client/src/const/branding.ts` — `brandLockupSrc(theme)` / `brandMarkSrc(theme)`.  
**Component:** `BrandLogo` reads `useTheme()` and swaps the PNG. Do **not** render a CSS wordmark on top of the lockup.  
**`/app` + personal sidebars:** expanded = lockup; collapsed rail = mark only.

---

## Brand assets (source of truth)

| File | Role |
|------|------|
| `client/public/brand/paystack-final-logo.png` | Transparent **on-light lockup** master |
| `client/public/brand/paystack-lockup.png` | Same lockup (full res) |
| `client/public/brand/paystack-lockup-128.png` | Navbar / Footer / Auth (light) |
| `client/public/brand/paystack-lockup-on-dark.png` | Inverted lockup master |
| `client/public/brand/paystack-lockup-on-dark-128.png` | Dark chrome lockup |
| `client/public/brand/paystack-mark-master.png` | On-light icon-only square |
| `client/public/brand/paystack-mark-on-dark.png` | On-dark icon-only |
| `client/public/brand/paystack-mark-128.png` | Favicon, emails, light mark |
| `client/public/brand/paystack-mark-on-dark-128.png` | Dark mark |
| `client/public/brand/paystack-icon-192.png` / `paystack-icon-512.png` | PWA icons (on-light mark) |

**HTML:** `client/index.html` favicon + Organization `logo` → `/brand/paystack-mark-128.png`.  
**Emails:** `shared/brandAssets.ts` → `BRAND_LOGO_PATH` (light mark on white mail clients).

---

## Replace artwork

```bash
node scripts/process-new-logo.mjs path/to/source.png
pnpm assets:brand-icons          # resize + on-dark + harden
# or stepwise:
pnpm assets:on-dark-logo
pnpm assets:harden-logos
```

`harden-brand-lockups.mjs` crushes soft alpha and removes dark/light fringe pixels that read as a second “ghost” wordmark.

Smoke-check:

1. Toggle **Dark** — `/`, `/app`, `/sign-in`: white “PayStack” + red “.ch”, diamond stack readable on charcoal — **no dark halo under letters**.
2. Toggle **Light** — same routes: black “PayStack” + red “.ch” on cream/white — **no light ghost behind letters**.
3. Favicon still the on-light mark.

---

## Landing screenshots (must match `/app`)

| Key | File | Lockup variant |
|-----|------|----------------|
| dashboard | `screenshot-dashboard-v7.jpg` | on-dark |
| revenue | `screenshot-revenue-v7.jpg` | on-dark |
| expenses | `screenshot-expenses-v7.jpg` | on-dark |
| reports | `screenshot-reports-v7.jpg` | on-dark |
| documents | `screenshot-documents-v7.jpg` | on-dark |
| personal | `screenshot-personal-v7.jpg` | on-light |

Mapped in `client/src/const/landingScreens.ts`. **Bump the suffix** (v7 → v8…) when replacing pixels.

### Critical: no double / ghost logo

Earlier patches only covered a small icon square, so the old wordmark (and “BUSINESS APP V3”) stayed under the new lockup — landing looked like two logos stacked. Soft alpha fringes on the PNG also looked like a second wordmark.

**Rules for `scripts/patch-landing-logos.mjs`:**

1. Prefer clean masters in `tmp-landing-v3/*.png` (never re-patch a previously layered JPG onto itself as the primary source).
2. Paint an **opaque sidebar-colored plate** over the **full brand block** (icon + wordmark + subtitle), typically ~`0,0 → 280×100` on 1536×1024 business shots — stop before the first nav label.
3. Sample plate color from the source **top-left gutter** (skip red/bright logo ink). Plate must match the sidebar chrome, not mid-panel grey.
4. Composite **exactly one** lockup, **flattened onto the plate** (no semi-transparent fringe). Height ≈ live `h-8` (32–36px). No CSS wordmark, no second mark.
5. Harden lockups first (`pnpm assets:harden-logos`). Soft alpha left = 0.
6. Dashboard upload hint should match live copy: **PDF / JPG / PNG / CSV** (`QuickDocumentUpload`).

```bash
# Drop fresh captures into tmp-landing-v3/ as dashboard.png, revenue.png, …
pnpm assets:harden-logos
pnpm assets:patch-landing-logos
```

### Prefer real captures when possible

Best match to “the inside”: log into `/app` (and `/personal`), dark theme, capture 1536×1024 (or 2×) of Dashboard / Revenue / Expenses / Reports / Documents / Personal Overview, put them in `tmp-landing-v3/`, run the patcher so the brand strip is the live lockup, bump `landingScreens.ts` to the next `vN`.

Marketing mockups are acceptable only if chrome (sidebar tabs, KPI cards, upload zone, tables) still matches current `ba-v3` / personal plan UI. Upload zone text must include **CSV**.

### No stacked logos on the landing page

Fixed navbar `BrandLogo` + in-shot sidebar lockup must not sit on top of each other. Platform tour screenshots stay `lg:sticky lg:top-24` so they clear the nav. Do not place a second CSS wordmark over `BrandLogo` or over the lockup inside shots.

---

## Checklist

- [ ] On-light + on-dark lockup/mark masters exist (transparent)
- [ ] `pnpm assets:brand-icons` run (includes harden)
- [ ] Lockups have **zero** soft-alpha fringe pixels
- [ ] `BrandLogo` / `/app` / personal sidebar switch with theme
- [ ] Landing shots show **one** lockup — no ghost wordmark / BUSINESS APP V3
- [ ] Landing plate color matches sidebar (not a grey “header bar”)
- [ ] Dashboard shot upload hint includes CSV
- [ ] `LANDING_SCREENSHOTS` point at current `vN` files
- [ ] Hard-refresh `/` and `/app` in both themes

---

## Out of scope

- Open Banking / live bank sync branding
- Promoting Ali lab features into `/app`
- Generating fake product UI that does not match current dashboard chrome
