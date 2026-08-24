# Outreach email — beta invite super prompt

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` |
| Heroes | dark only: `paystack-beta-campaign-hero-fr-dark.jpg` / `…-en-dark.jpg` |
| GIF | `upload-demo-v6.gif` (true black; also updates `upload-demo-dark.gif`) |
| Generator | `node scripts/generate-outreach-upload-demo.mjs` |
| Calendar | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | `Lucas \| Paystack <lucas@paystack.ch>` |
| Pattern ref | `spinella-geneva` emails: full black body + outer table (`#000` / `#0c0c0c`) |

## Theme rules (locked black — Spinella style)

1. **Whole email is black.** `body`, outer table, inner 600px table, and letter `<td>`s use `bgcolor="#000000"` + `background-color:#000000`.
2. **White body text** `#FFFFFF` (class `.txt`). Muted `#B0B0B0`.
3. Only the **red CTA** may use another background (`#E8423F`).
4. **No light/dark image swap.** Gmail ignores media queries — ship dark heroes + black GIF only.
5. `color-scheme: dark` only (meta + `:root`).
6. Never reintroduce cream / pink / `#FFF5F4` shells.
7. GIF must be **true black**, not navy/blue-gray — generator remaps cool dark chrome via `toTrueBlackDashboard`.

## Layout

FR hero → FR letter → FR CTA → black GIF → English → EN hero → EN letter → EN CTA → footer.

Merge: `{{11.`3`}}`.

## Make.com

After every HTML change: copy file to Downloads, **re-paste full HTML into Make**, send a **new** test. Old emails never update. Wait for CDN deploy of `/outreach/upload-demo-v6.gif` before testing the GIF.

## Checklist

- [ ] Grep HTML: zero `FFF5F4`, zero `-light.jpg` / `upload-demo-light`
- [ ] Every major `td` / table has black `bgcolor`
- [ ] Text is white; CTA is red
- [ ] GIF URL is `upload-demo-v6.gif` and looks black (not navy)
