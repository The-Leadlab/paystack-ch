# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (Outreach 1 / `beta-invite`).

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` |
| Hero light FR / EN | `…/outreach/paystack-beta-campaign-hero-fr-light.jpg` / `…-en-light.jpg` |
| Hero dark FR / EN | `…/outreach/paystack-beta-campaign-hero-fr-dark.jpg` / `…-en-dark.jpg` |
| GIF light | `…/outreach/upload-demo-light.gif` |
| GIF dark | `…/outreach/upload-demo-dark.gif` |
| GIF generator | `node scripts/generate-outreach-upload-demo.mjs` |
| Calendar | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (mandatory)

1. **No shell background** on body/tables/letter cells — no cream, pink, or brown. Let Gmail’s native white (light) / black (dark) show through. Only set text colors.
2. Phone **light** → light heroes + `upload-demo-light.gif`.
3. Phone **dark** → dark heroes + `upload-demo-dark.gif`.
4. Use classes `.light-img` (default `display:block`) and `.dark-img` (default `display:none`) with `@media (prefers-color-scheme: dark)` swap.
5. Letter text: inline dark `#1A1A1A` + dark-mode override to `#FFFFFF` via `.body-text`.
6. Meta/footer: muted gray inline + lighter gray in dark media query.
7. No `border-radius` on heroes/GIF/CTA (avoids white corner halos).
8. Never use `#FFF5F4` / cream shells — Gmail remaps them to pink (light) or brown (dark).

## Layout

FR hero → FR letter → FR CTA → **theme GIF** → English → EN hero → EN letter → EN CTA → footer.

Merge: `{{11.`3`}}`.

## Make.com

Re-paste HTML from Downloads after every deploy. Wait until new GIF URLs are live before mass send.

## Checklist

- [ ] Light phone: Gmail-white letter area (not pink), light heroes, light GIF
- [ ] Dark phone: Gmail-black letter area (not brown), dark heroes, dark GIF
- [ ] No white corner borders
- [ ] Name merge + calendar CTA

## Out of scope

Ali lab promo; Calendly unless asked.
