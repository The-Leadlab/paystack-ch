# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (Outreach 1 / `beta-invite`): Make.com HTML must match the campaign creative and stay readable on phones in **any** system theme (Gmail dark or light).

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` (refresh after each edit) |
| Hero FR (locked) | `…/outreach/paystack-beta-campaign-hero-fr-dark.jpg` |
| Hero EN (locked) | `…/outreach/paystack-beta-campaign-hero-en-dark.jpg` |
| Product demo GIF | `…/outreach/upload-demo-v4.gif` |
| GIF generator | `node scripts/generate-outreach-upload-demo.mjs` |
| Calendar CTA | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | Prefer `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (mandatory — locked dark, no OS swap)

Gmail **auto-inverts** emails that advertise `color-scheme: dark` / `dark light`. That produced: white body + dark heroes (and broken light-mode colors). Dual `prefers-color-scheme` swaps are unreliable in Gmail anyway.

**Ship one locked dark email for every phone mode:**

1. `<meta name="color-scheme" content="light only">` and `color-scheme: light only` — tells Gmail/iOS **do not invert** our colors.
2. Do **not** use `@media (prefers-color-scheme: …)` for heroes or text.
3. Every table/td: inline `background-color:#000000` + `bgcolor="#000000"`.
4. Letter text: inline `color:#FFFFFF` (and meta `#A3A3A3`).
5. Heroes: **dark JPGs only** (no light hero `<img>`).
6. GIF stays between FR CTA and English separator.
7. Same look on phone dark mode and phone light mode: black shell, white type, dark creatives.

### Product demo GIF (between FR and EN)

- Full real Paystack dashboard (`fit: contain`, never crop).
- Small realistic cursor + PDF.
- Host as `upload-demo-v4.gif` (bump version when regenerating).
- Regenerate: `node scripts/generate-outreach-upload-demo.mjs`.

## Layout rules

1. FR dark hero → French letter → FR CTA.
2. Product demo GIF.
3. English separator → EN dark hero → English letter → EN CTA.
4. Merge: `Bonjour {{11.`3`}},` / `Hi {{11.`3`}},`.
5. Arial/Helvetica 16px, normal weight for letter copy.
6. Red CTA → calendar URL.
7. Footer: Paystack.ch + Geneva + `lucas@paystack.ch`.
8. Subject: `Vous avez été choisi`. Preheader: bêta, 5–10k, sans frais, −25 % à vie.

## Make.com

- Merge: `{{11.`3`}}`
- Re-paste HTML from Downloads after every deploy
- From name is not HTML — SMTP/Gmail From name or Google Admin display name
- After deploy, confirm dark heroes + GIF URLs are live before mass send

## Checklist (theme QA)

- [ ] Phone **dark**: black shell, white text, dark heroes, GIF visible — not white body / not brown
- [ ] Phone **light**: same locked dark look (not inverted, not cream)
- [ ] Name merge + calendar CTA work
- [ ] FR → GIF → EN order

## Out of scope

- Ali lab promotion
- Replacing calendar with Calendly unless asked
- Dual light/dark hero swaps (removed — breaks Gmail)
