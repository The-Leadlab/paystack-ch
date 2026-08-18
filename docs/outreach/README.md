# Paystack client outreach (HTML)

Professional letter-style HTML: 600px table, Paystack lockup, cream `#FFF5F4` and red `#E8423F`, Georgia body, English then French in the same email.

| File | Tone | Subject |
|------|------|---------|
| `paystack-beta-invite.html` | Softer — origin story + beta invite | A private beta for Geneva SMEs / Une bêta privée pour les PME à Genève |
| `paystack-beta-direct.html` | Direct — selected as a field leader | You are one of 200 beta testers / Vous faites partie des 200 testeurs |

Do not mention Paystack’s own price. Both emails say almost CHF 5–10,000 of expense a year. Beta is zero-cost. First 100 who become clients get 25% off for life.

**Before sending:** find-replace `[First name]`, `[Your name]`, and `[Business name]` (direct email).

**Do not use** the old “test Paystack v2 / same login” copy. That wave comes later.

**Preview:** open the HTML in a browser. Logo loads from `https://www.paystack.ch/brand/…`.

**Joshua send-ready (filled names, EN then FR in one HTML):**
- `send/joshua-invite.html`
- `send/joshua-direct.html`

Send both via Resend (needs `RESEND_API_KEY`):

```bash
RESEND_API_KEY=re_... node scripts/send-outreach-resend.mjs
```

Defaults: `to=joshua@the-leadlab.com`, `from=Paystack <lucas@paystack.ch>`. Override with `OUTREACH_TO` / `NEW_USER_NOTIFY_FROM`.

**Admin UI:** `/admin` → **Cold outreach**. Upload CSV (`name,email,company,extra`), HTML or plain text, preview, send via Resend (`POST /api/admin/outreach`). Merge tags: `{{name}}` `{{email}}` `{{company}}` `{{extra}}` `{{sender}}`.

CTA is reply / `mailto:lucas@paystack.ch`. Swap in a Calendly (or other booking) URL when you have one.
