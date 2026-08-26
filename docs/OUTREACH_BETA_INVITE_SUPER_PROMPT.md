# Outreach email — beta invite super prompt

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` |
| Heroes | `paystack-beta-hero-fr-v2.jpg` / `paystack-beta-hero-en-v2.jpg` |
| GIF | `upload-demo-v7.gif` |
| Cell bg lock | `email-bg-black.png` |
| Calendar | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (always laptop black — ignore phone mode)

1. **One design only:** black shell + black hero/GIF images. Never light variants.
2. **`color-scheme: light only`** — critical. `dark only` made Gmail iOS *invert* the black HTML letter to white (hero image stayed black; body went white).
3. Shell / cells: `bgcolor="#0c0c0c"` + `background-image: url(.../email-bg-black.png)` and/or `linear-gradient(#0c0c0c,#0c0c0c)`.
4. **Full-bleed:** outer wrapper padding `0` (no `24px 12px` gutters) so phone has no white side frame around the black block.
5. White text `#FFFFFF`, muted `#B0B0B0`, red CTA only.
6. Never cream / pink / `#FFF5F4`.

## Make.com

1. Wait for deploy of `email-bg-black.png` (heroes/GIF already live).
2. Copy HTML → Downloads paste file.
3. **Delete** old Make HTML → paste full new file.
4. Send a **new** test (old emails keep white letter forever).

## Checklist

- [ ] Meta is `light only` (not `dark only`)
- [ ] Letter cells use `email-bg-black.png` background
- [ ] Phone dark mode: black letter under black hero (not white)
- [ ] Laptop: unchanged black look
