# Paystack.ch — Brand Logo + Dark Theme + Landing Screenshots Super Prompt

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
pnpm assets:brand-icons          # also runs generate-on-dark-logo.mjs
# or only invert:
pnpm assets:on-dark-logo
```

Smoke-check:

1. Toggle **Dark** — `/`, `/app`, `/sign-in`: white “PayStack” + red “.ch”, diamond stack readable on charcoal.
2. Toggle **Light** — same routes: black “PayStack” + red “.ch” on cream/white.
3. Favicon still the on-light mark.

---

## Landing screenshots

| Key | File | Lockup variant |
|-----|------|----------------|
| dashboard | `screenshot-dashboard-v5.jpg` | on-dark |
| revenue | `screenshot-revenue-v5.jpg` | on-dark |
| expenses | `screenshot-expenses-v5.jpg` | on-dark |
| reports | `screenshot-reports-v5.jpg` | on-dark |
| documents | `screenshot-documents-v5.jpg` | on-dark |
| personal | `screenshot-personal-v5.jpg` | on-light (light chrome) |

Mapped in `client/src/const/landingScreens.ts`. **Bump the suffix** (v5 → v6…) when replacing pixels.

```bash
pnpm assets:patch-landing-logos
```

Reads `tmp-landing-v3/*.png` if present, else existing `screenshot-*-v4.jpg`. Overlays the matching lockup on the sidebar brand strip.

**Rule:** Landing imagery must show the **same diamond-stack lockup** as the live theme of that screen. No legacy three red bars. Dark product shots must not use the black wordmark.

---

## Checklist

- [ ] On-light + on-dark lockup/mark masters exist (transparent)
- [ ] `pnpm assets:brand-icons` run
- [ ] `BrandLogo` / `/app` / personal sidebar switch with theme
- [ ] Landing `LANDING_SCREENSHOTS` point at current vN files
- [ ] Favicon + JSON-LD still on-light mark
- [ ] Hard-refresh `/` and `/app` in both themes

---

## Out of scope

- Open Banking / live bank sync branding
- Promoting Ali lab features into `/app`
- Generating fake product UI that does not match current dashboard chrome
