# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (Outreach 1 / `beta-invite`): Make.com HTML must match the **dark campaign creative**.

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` (refresh after each edit) |
| Campaign hero (FR visual) | `client/public/outreach/paystack-beta-campaign-hero-fr.jpg` → `https://www.paystack.ch/outreach/paystack-beta-campaign-hero-fr.jpg` |
| Design reference | Dark mock: logo, headline, cost chart, benefits, −25% offer, letter, red CTA |
| Calendar CTA | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | Prefer `Lucas \| Paystack <lucas@paystack.ch>` (Make SMTP / Google Admin) |

## Visual rules (do not drift)

1. **Black canvas** (`#000000`) — the email *is* the dark campaign, not the old cream letter.
2. **Hero image first** — hosted JPG of logo + « Une bêta privée… » + chart/benefits + exclusive −25% offer. Do not rebuild the chart in HTML tables (pixel fidelity).
3. **Letter body in HTML** below the hero so Make.com can personalize `Bonjour {{11.`3`}},`.
4. **One body font**: Arial/Helvetica, **16px**, `font-weight:normal` for all letter copy (no random bold).
5. **CTA**: full-width red button (`#E8423F`), white label, calendar link; secondary line « Ou répondez… · www.paystack.ch ».
6. **Footer tagline**: `Paystack.ch — vos finances automatisées` + Geneva + `lucas@paystack.ch`.
7. **French first**, then a dark English block (same type scale) after an « English » separator.
8. Subject: `Vous avez été choisi` (or bilingual hook). Preheader: bêta, 5–10k, sans frais, −25 % à vie.
9. Absolute HTTPS image URLs only. Re-export hero when the creative changes; keep ~80–100KB JPEG.

## Make.com

- Merge first name: `{{11.`3`}}`
- Paste HTML from Downloads after every deploy
- From name cannot be fixed in HTML — use SMTP From name or Google Admin display name

## Checklist

- [ ] Open HTML in browser: black background, hero loads from paystack.ch
- [ ] Name merge works in Make test send
- [ ] Calendar CTA works
- [ ] FR block above EN
- [ ] No cream/light card leftover from older templates

## Out of scope

- Ali lab promotion
- Replacing calendar with Calendly unless asked
