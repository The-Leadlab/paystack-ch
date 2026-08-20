# Outreach email — beta invite super prompt

Use this when updating **Geneva SME cold outreach** (especially Outreach 1 / `beta-invite`): copy, CTA, bilingual order, and the upload demo media.

## Source of truth

| Asset | Path / URL |
|-------|------------|
| Letter HTML (file) | `docs/outreach/paystack-beta-invite.html` |
| Admin preset | `shared/outreachPresets.ts` → `beta-invite` |
| Branded wrapper | `shared/outreachMail.ts` → `wrapBrandedLetterHtml` |
| Demo GIF | `client/public/outreach/upload-demo-v2.gif` → `https://www.paystack.ch/outreach/upload-demo-v2.gif` |
| Demo PNG fallback | `client/public/outreach/upload-demo-v2.png` |
| GIF generator | `node scripts/generate-outreach-upload-demo.mjs` (uses ffmpeg two-pass palette) |
| Calendar CTA | `OUTREACH_DEMO_CALENDAR_URL` = `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From mailbox | `Lucas | Paystack <lucas@paystack.ch>` (also Joshua/Ali variants) |

## Correct invite rules (do not drift)

1. **French first**, then English (Geneva SME audience).
2. Subject: `You've been chosen / Vous avez été choisi` (hook in the inbox — not the long “private beta…” line)
3. Preheader (FR): bêta privée, CHF 5–10k, échange sans frais, −25 % à vie.
4. CTA buttons → Google Calendar booking link (not bare mailto), with “or reply / www.paystack.ch” under each.
5. Sign-off: Paystack.ch team + `lucas@paystack.ch`
6. **From display:** `Lucas | Paystack <lucas@paystack.ch>` (Joshua/Ali same pattern). Never send with a bare local-part From Name like `lucas` — Gmail then shows only “lucas” and looks unprofessional.
7. Merge tags for admin/Resend: `{{name}}` `{{email}}` `{{company}}` `{{extra}}` `{{sender}}`
8. Instantly/Lemlist: map First Name into `{{name}}`; set **From Name** to `Lucas | Paystack`.
9. Do **not** mention Paystack’s own price. Keep almost CHF 5–10,000 of expense a year + first 100 → 25% off for life.
10. Include the **upload demo** under the logo: animated GIF preferred (`upload-demo-v2.gif`); PNG exists as fallback.

## Upload demo media

- Small looping GIF: mouse cursor dragging a PDF into the dark dashboard drop zone (`DROP PDF / JPG / PNG / CSV`).
- Regenerate after visual changes:

```bash
node scripts/generate-outreach-upload-demo.mjs
```

- Keep file under ~100KB for email clients. Host only under `client/public/outreach/` so production serves `https://www.paystack.ch/outreach/…`.
- In HTML: `<img src="…/upload-demo-v2.gif" width="504" …>`. Absolute HTTPS URLs only (no relative paths in sent mail). Bump `vN` when replacing pixels so caches don’t serve a broken file.

## Checklist before send

- [ ] Open `docs/outreach/paystack-beta-invite.html` in a browser — logo + GIF load from paystack.ch
- [ ] FR block above EN; calendar CTAs work
- [ ] Admin → Cold outreach → preset **beta-invite** matches the file
- [ ] Test send to yourself via Resend / admin UI
- [ ] After deploy, hard-refresh so `/outreach/upload-demo-v2.gif` is live before mass send

## Out of scope

- Changing plan pricing or Stripe checkout copy
- Promoting Ali lab features
- Replacing calendar with Calendly unless product asks
