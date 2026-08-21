# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (especially Outreach 1 / `beta-invite`): Make.com HTML, bilingual order, theme-aware logo, posters, and typography.

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML (file) | `docs/outreach/paystack-beta-invite.html` |
| Make.com paste copy | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` (refresh after each edit) |
| Admin preset | `shared/outreachPresets.ts` → `beta-invite` |
| Branded wrapper | `shared/outreachMail.ts` → `wrapBrandedLetterHtml` |
| Logo light (default) | `client/public/brand/paystack-lockup-email-light.png` → `https://www.paystack.ch/brand/paystack-lockup-email-light.png` |
| Logo dark (device dark mode) | `client/public/brand/paystack-lockup-email-dark.png` → `https://www.paystack.ch/brand/paystack-lockup-email-dark.png` |
| FR poster | `client/public/outreach/paystack-poster-salaire.jpg` |
| EN poster | `client/public/outreach/paystack-poster-salaire-en.jpg` |
| Calendar CTA | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From mailbox | Prefer `Lucas \| Paystack <lucas@paystack.ch>` (Make SMTP / Google Admin display name) |

## Correct invite rules (do not drift)

1. **French first**, then English (Geneva SME audience).
2. Subject: `You've been chosen / Vous avez été choisi` (or FR-only `Vous avez été choisi` in Make).
3. Preheader (FR): bêta privée, CHF 5–10k, échange sans frais, −25 % à vie.
4. Layout order:
   - Red bar + **theme-aware logo**
   - French copy + FR CTA
   - **FR poster** (`paystack-poster-salaire.jpg`)
   - English separator
   - English copy + EN CTA
   - **EN poster** (`paystack-poster-salaire-en.jpg`)
   - Footer
5. CTA buttons → Google Calendar booking link, with “or reply / www.paystack.ch” under each.
6. Sign-off: Paystack.ch team + `lucas@paystack.ch`
7. **Make.com** merge tag: `{{11.`3`}}` (first name from Sheets module 11). Not Resend `{{name}}` unless sending via admin/Resend.
8. Do **not** mention Paystack’s own price. Keep almost CHF 5–10,000 of expense a year + first 100 → 25% off for life.
9. Absolute HTTPS image URLs only. Bump filenames when replacing pixels so caches refresh.

## Theme-aware logo (same idea as the website)

The site swaps `paystack-lockup.png` (light UI) ↔ `paystack-lockup-on-dark.png` (dark UI). Email must do the same for the **device** color scheme:

1. Set `<meta name="color-scheme" content="light dark">` and `color-scheme: light dark` in a `<style>` block.
2. Render **both** logos in one cell:
   - `.logo-light` → email-light PNG (default `display:block`)
   - `.logo-dark` → email-dark PNG (default `display:none`)
3. `@media (prefers-color-scheme: dark)`: hide light, show dark.
4. Keep a solid plate behind each lockup (white plate on light asset, near-black on dark) so Gmail/iOS dark mode does not eat transparent wordmarks.
5. Do **not** rely on a single cream-plate lockup alone — that fails when the client inverts or forces dark chrome.

From name (“lucas” in inbox) is **not** an HTML/logo problem: fix via Make SMTP From name or Google Admin display name.

## Typography (strict)

One typeface for all letter text: **Georgia, 'Times New Roman', Times, serif**.

| Role | Size | Weight |
|------|------|--------|
| Everything (headlines, body, greetings, footer, meta under CTAs, “English” label) | `16px` / `line-height:1.7` | `font-weight:normal` only |
| CTA button label only | `16px` Arial/Helvetica (UI chrome) | bold OK on the red button |

Rules:

- **No** mixed Georgia + Arial sizes in the letter body.
- **No** oversized punchlines (was 22px) — headlines use the same 16px as body.
- **No** `<strong>`, `<b>`, or random bold on headings or money lines — all normal text.
- Do not invent a fourth size for footnotes; keep 16px and use color `#6F6669` only for secondary meta if needed.

## Posters

- FR: after French CTA, before English separator.
- EN: after English CTA, before footer.
- Host under `client/public/outreach/`. Prefer JPG ~80–100KB for mail clients.

## Checklist before send

- [ ] Open `docs/outreach/paystack-beta-invite.html` in browser light + dark (OS theme) — correct lockup each time
- [ ] FR poster under FR; EN poster under EN
- [ ] All letter copy normal weight, one Georgia 16px size
- [ ] Make.com HTML updated from Downloads copy after deploy
- [ ] Hard-refresh `paystack.ch/brand/paystack-lockup-email-*.png` and both posters before mass send

## Out of scope

- Changing plan pricing or Stripe checkout copy
- Promoting Ali lab features
- Replacing calendar with Calendly unless product asks
