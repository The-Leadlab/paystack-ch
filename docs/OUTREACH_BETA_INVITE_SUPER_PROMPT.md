# Outreach email — beta invite super prompt

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` |
| Heroes light | `paystack-beta-campaign-hero-fr-light.jpg` / `…-en-light.jpg` |
| Heroes dark | `paystack-beta-campaign-hero-fr-dark.jpg` / `…-en-dark.jpg` |
| GIF light | `upload-demo-light.gif` |
| GIF dark | `upload-demo-dark.gif` |
| Generator | `node scripts/generate-outreach-upload-demo.mjs` |
| Calendar | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (do not break these)

1. **Never** put cream / pink / `#FFF5F4` / `#FFF5F4` / brown / gray shells on `body`, tables, or letter `<td>`s. That is what Gmail turns into rose (light) or brown (dark).
2. **No background box** behind the letter. Only Gmail’s native white/black shows through.
3. Only the **red CTA button** may have `bgcolor` / `background-color`.
4. Text: inline dark `#1A1A1A` (class `.txt`) → white in `@media (prefers-color-scheme: dark)`.
5. Muted text: `#5C5C5C` (class `.muted`) → `#B0B0B0` in dark mode.
6. Images: `.light-only` default visible; `.dark-only` default hidden; swap in dark media query.
7. GIF: light phone → `upload-demo-light.gif`; dark phone → `upload-demo-dark.gif`.
8. No `border-radius` on heroes/GIF.

## Layout

FR hero → FR letter → FR CTA → theme GIF → English → EN hero → EN letter → EN CTA → footer.

Merge: `{{11.`3`}}`.

## Make.com

After every HTML change: copy file to Downloads, **re-paste full HTML into Make**, send a **new** test. Old emails keep the old rose box forever.

## Checklist

- [ ] Grep the HTML: zero matches for `FFF5F4` or `shell-bg`
- [ ] Light phone: Gmail white behind text (not rose); light heroes; light GIF
- [ ] Dark phone: Gmail black behind text (not brown); dark heroes; dark GIF
