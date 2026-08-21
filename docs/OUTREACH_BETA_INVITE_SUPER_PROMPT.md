# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (Outreach 1 / `beta-invite`): Make.com HTML must match the campaign creative and **follow the device light/dark theme**.

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` (refresh after each edit) |
| Hero **light** FR | `…/paystack-beta-campaign-hero-fr-light.jpg` |
| Hero **dark** FR | `…/paystack-beta-campaign-hero-fr-dark.jpg` |
| Hero **light** EN | `…/paystack-beta-campaign-hero-en-light.jpg` |
| Hero **dark** EN | `…/paystack-beta-campaign-hero-en-dark.jpg` |
| Calendar CTA | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | Prefer `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (mandatory — same idea as the website logo)

The site swaps brand lockups for light vs dark UI. The campaign email must do the same for the **device / mail client color scheme** so nothing vanishes and both themes stay readable.

1. Set `<meta name="color-scheme" content="light dark">` and `color-scheme: light dark`.
2. Render **both** heroes in one cell:
   - `.hero-light` → light JPG (default `display:block`) — cream/white canvas, dark type, red accents
   - `.hero-dark` → dark JPG (default `display:none`) — black canvas, white type, red accents
3. `@media (prefers-color-scheme: dark)`: hide light hero, show dark hero; flip shell background and letter colors.
4. **Default (no media query / Outlook) = light theme** so white-theme phones and laptops always see a clear cream letter + light hero.
5. Letter copy uses classes `.body-text` / `.meta-text` / `.shell-bg` with inline light colors + dark overrides in the same `<style>` block.
6. Never ship a single dark-only hero: Gmail/iOS light mode would show black-on-black or washed text.
7. When regenerating the creative, export **both** light and dark JPGs (~80–100KB each). Keep red (`#E8423F`) vivid on both.

### How to regenerate dual heroes

- Dark master: crop from the approved campaign mock (logo through −25% offer).
- Light variant: luminance remap from dark (black→near-white, white bars/text→charcoal) while **preserving brand red**. Script pattern lives in prior commits / can be re-run with `sharp` raw pixel pass.
- After replace: bump filenames or cache-bust query only if CDNs stick; otherwise overwrite `*-light.jpg` / `*-dark.jpg` and hard-refresh before mass send.

## Layout rules

1. FR hero image(s) first (chart + benefits + exclusive offer).
2. HTML French letter below for Make personalization: `Bonjour {{11.`3`}},`.
3. English separator, then **EN hero** (light/dark pair), then English letter + CTA.
4. One body font: Arial/Helvetica, **16px**, `font-weight:normal` for letter copy.
5. Red full-width CTA → calendar URL; secondary « Ou répondez… · www.paystack.ch ».
6. Footer: `Paystack.ch — vos finances automatisées` + Geneva + `lucas@paystack.ch`.
7. Subject: `Vous avez été choisi`. Preheader: bêta, 5–10k, sans frais, −25 % à vie.

## Make.com

- Merge: `{{11.`3`}}`
- Re-paste HTML from Downloads after every deploy
- From name is not HTML — SMTP From name or Google Admin display name

## Checklist (theme QA)

- [ ] OS **light**: open HTML / test send — light hero + dark text on cream; all chart labels readable
- [ ] OS **dark** (Apple Mail / client that honors `prefers-color-scheme`): dark hero + white letter text; red CTA still clear
- [ ] Clients that ignore CSS still get **light** defaults (nothing invisible)
- [ ] Name merge + calendar CTA work
- [ ] FR above EN

## Out of scope

- Ali lab promotion
- Replacing calendar with Calendly unless asked
