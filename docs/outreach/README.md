# Paystack client outreach (HTML)

Professional letter-style HTML: 600px table, Paystack lockup, cream `#FFF5F4` and red `#E8423F`. **Invite email is French first, then English.** Direct email stays EN then FR unless changed.

| File | Tone | Subject |
|------|------|---------|
| `paystack-beta-invite.html` | Softer — origin story + beta invite + upload GIF | A private beta for Geneva SMEs / Une bêta privée pour les PME à Genève |
| `paystack-beta-direct.html` | Direct — selected as a field leader | You are one of 200 beta testers / Vous faites partie des 200 testeurs |

Do not mention Paystack’s own price. Both emails say almost CHF 5–10,000 of expense a year. Beta is zero-cost. First 100 who become clients get 25% off for life.

**Upload demo:** `https://www.paystack.ch/outreach/upload-demo.gif` (still: `upload-demo.png`). Regenerate with `node scripts/generate-outreach-upload-demo.mjs`.

**CTA:** Google Calendar `https://calendar.app.google/gjusbBhAfBKaEh1J6` (Réserver une démo / Book a free demo).

**Merge tags:** `{{name}}` `{{email}}` `{{company}}` `{{extra}}` `{{sender}}` (admin / Resend). For Instantly, map First Name → `{{name}}`.

**Super prompt:** [`docs/OUTREACH_BETA_INVITE_SUPER_PROMPT.md`](../OUTREACH_BETA_INVITE_SUPER_PROMPT.md)

**Preview:** open the HTML in a browser. Logo + GIF load from `https://www.paystack.ch/…` (must be deployed).

**Joshua send-ready:** `send/joshua-invite.html`, `send/joshua-direct.html`

```bash
RESEND_API_KEY=re_... node scripts/send-outreach-resend.mjs
```

Defaults: `to=joshua@the-leadlab.com`, `from=Paystack <lucas@paystack.ch>`.

**Admin UI:** `/admin` → **Cold outreach**. Preset **beta-invite** matches this letter (FR-first + GIF + calendar).
