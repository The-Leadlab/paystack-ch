# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (Outreach 1 / `beta-invite`): Make.com HTML must follow the **phone light/dark theme**, with no white corner borders.

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` (refresh after each edit) |
| Hero **light** FR | `…/outreach/paystack-beta-campaign-hero-fr-light.jpg` |
| Hero **dark** FR | `…/outreach/paystack-beta-campaign-hero-fr-dark.jpg` |
| Hero **light** EN | `…/outreach/paystack-beta-campaign-hero-en-light.jpg` |
| Hero **dark** EN | `…/outreach/paystack-beta-campaign-hero-en-dark.jpg` |
| Product demo GIF | `…/outreach/upload-demo-v4.gif` |
| GIF generator | `node scripts/generate-outreach-upload-demo.mjs` |
| Calendar CTA | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | Prefer `Lucas \| Paystack <lucas@paystack.ch>` |

## Theme rules (mandatory)

Phone **light** → cream/white email + light heroes.  
Phone **dark** → black email + dark heroes.  
No white frames, corner halos, or border lines around images.

1. `<meta name="color-scheme" content="light dark">` and `color-scheme: light dark`.
2. **Default (light)** = cream shell `#FFF5F4`, dark letter text `#2B2B2B`, light heroes `display:block`, dark heroes `display:none`.
3. `@media (prefers-color-scheme: dark)` = shell `#000000`, letter `#FFFFFF`, hide light heroes, show dark heroes.
4. Every table/td uses class `.shell-bg` + matching inline `bgcolor` / `background-color`.
5. Letter copy uses `.body-text` / `.meta-text` / `.footer-muted` with inline light colors + dark overrides in the same `<style>` block.
6. **No borders on media:** heroes + GIF use `border:0; outline:none; border-radius:0`. No side padding around the GIF (full-bleed in the 600px column).
7. **No rounded CTA** (`border-radius:0`) — rounded buttons can show white corner halos in dark mode.
8. Do not add hairline separators that read as white frames; English label alone is enough.
9. Export **both** light and dark hero JPGs when regenerating creatives.

### Product demo GIF (between FR and EN)

- Full real Paystack dashboard (`fit: contain`, never crop).
- Small realistic cursor + PDF.
- Host as `upload-demo-v4.gif` (bump version when regenerating).
- No `border-radius` on the GIF in the email HTML.

## Layout rules

1. FR light/dark hero → French letter → FR CTA.
2. Product demo GIF (full width of column).
3. “English” → EN light/dark hero → English letter → EN CTA.
4. Merge: `Bonjour {{11.`3`}},` / `Hi {{11.`3`}},`.
5. Arial/Helvetica 16px, normal weight for letter copy.
6. Red CTA → calendar URL.
7. Footer: Paystack.ch + Geneva + `lucas@paystack.ch`.
8. Subject: `Vous avez été choisi`. Preheader: bêta, 5–10k, sans frais, −25 % à vie.

## Make.com

- Merge: `{{11.`3`}}`
- Re-paste HTML from Downloads after every deploy
- From name is not HTML — SMTP/Gmail From name or Google Admin display name

## Checklist (theme QA)

- [ ] Phone **light**: cream shell, dark text, light heroes — no odd borders
- [ ] Phone **dark**: pure black shell, white text, dark heroes — **no white corners / side strips**
- [ ] GIF has square edges (no rounded white halo)
- [ ] Name merge + calendar CTA work
- [ ] FR → GIF → EN order

## Out of scope

- Ali lab promotion
- Replacing calendar with Calendly unless asked
- Locked dark-only email (removed — phone theme must switch)
