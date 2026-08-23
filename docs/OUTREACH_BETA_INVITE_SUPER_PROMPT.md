# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (Outreach 1 / `beta-invite`): Make.com HTML must match the campaign creative and stay readable in **device dark mode** (especially Gmail on phones).

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` (refresh after each edit) |
| Hero **dark** FR (default) | `…/outreach/paystack-beta-campaign-hero-fr-dark.jpg` |
| Hero **light** FR | `…/outreach/paystack-beta-campaign-hero-fr-light.jpg` |
| Hero **dark** EN (default) | `…/outreach/paystack-beta-campaign-hero-en-dark.jpg` |
| Hero **light** EN | `…/outreach/paystack-beta-campaign-hero-en-light.jpg` |
| Product demo GIF | `…/outreach/upload-demo-v4.gif` (PNG: `upload-demo-v4.png`) |
| GIF generator | `node scripts/generate-outreach-upload-demo.mjs` |
| Calendar CTA | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | Prefer `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (mandatory — dark-first)

Gmail dark mode remaps light cream shells (`#FFF5F4`) to **brown** and often **ignores** `prefers-color-scheme` image swaps. Shipping light heroes as the default leaves white cards on a brown shell. Fix: **default to pure black + dark heroes**.

1. Set `<meta name="color-scheme" content="dark light">` and `color-scheme: dark light`.
2. Inline + `bgcolor` shell = `#000000` (never cream as the default).
3. Render **both** heroes in each hero cell:
   - `.hero-dark` → dark JPG — **default** `display:block` (black canvas, white type, red accents)
   - `.hero-light` → light JPG — **default** `display:none`
4. `@media (prefers-color-scheme: light)`: hide dark hero, show light hero; flip shell to cream `#FFF5F4` and letter text to dark.
5. Letter copy uses `.body-text` / `.meta-text` / `.shell-bg` with **inline dark colors** (`#FFFFFF` body) + light overrides in the same `<style>` block.
6. Keep dual heroes (never dark-only forever): light OS clients that honor the media query still get cream + light creatives.
7. When regenerating the creative, export **both** light and dark JPGs (~80–100KB each). Keep red (`#E8423F`) vivid on both.

### How to regenerate dual heroes

- Dark master: crop from the approved campaign mock (logo through −25% offer).
- Light variant: luminance remap from dark (black→near-white, white bars/text→charcoal) while **preserving brand red**.
- After replace: overwrite `*-light.jpg` / `*-dark.jpg` and hard-refresh before mass send.

### Product demo GIF (between FR and EN)

- Place **after** the French CTA and **before** the “English” separator.
- Must show the **full real Paystack dashboard** — `fit: contain`, **never crop** the product UI.
- Mouse + PDF must be **small and realistic** (system-cursor scale; PDF ~ table status-chip size), not oversized overlays.
- Host as `upload-demo-v4.gif` (bump version when regenerating so CDNs/clients drop the old loop).
- Regenerate: `node scripts/generate-outreach-upload-demo.mjs` (composites `tmp-landing-v3/dashboard.png` + cursor/PDF overlays via sharp + ffmpeg).
- Also refresh `OUTREACH_UPLOAD_DEMO_GIF_URL` / PNG in `shared/outreachMail.ts` when the admin preset should match.

## Layout rules

1. FR dark/light hero pair first (chart + benefits + exclusive offer).
2. HTML French letter for Make personalization: `Bonjour {{11.`3`}},`.
3. FR red CTA → calendar URL.
4. **Product demo GIF** (dashboard drag-and-drop).
5. English separator, then **EN** dark/light hero pair, English letter + CTA.
6. One body font: Arial/Helvetica, **16px**, `font-weight:normal` for letter copy.
7. Footer: `Paystack.ch — vos finances automatisées` + Geneva + `lucas@paystack.ch`.
8. Subject: `Vous avez été choisi`. Preheader: bêta, 5–10k, sans frais, −25 % à vie.

## Make.com

- Merge: `{{11.`3`}}`
- Re-paste HTML from Downloads after every deploy
- From name is not HTML — SMTP From name or Google Admin display name
- After deploy, wait until `https://www.paystack.ch/outreach/upload-demo-v4.gif` and the dark hero JPGs are live before mass send

## Checklist (theme QA)

- [ ] Phone **dark** (Gmail): shell is **black** (not brown); heroes are **dark** (not white cards); text white; GIF loops between FR and EN
- [ ] OS **light** (Apple Mail / client that honors `prefers-color-scheme`): cream shell + light heroes + dark letter text
- [ ] Clients that ignore CSS still get **dark** defaults (black + dark heroes — readable in Gmail dark)
- [ ] Name merge + calendar CTA work
- [ ] FR → GIF → EN order

## Out of scope

- Ali lab promotion
- Replacing calendar with Calendly unless asked
