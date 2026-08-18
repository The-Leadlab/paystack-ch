# Paystack v2 client outreach (HTML)

Branded HTML emails, same pattern as Spinella campaigns (`docs/*.html` in `spinella-geneva`): 600px table, hosted logo, brand colours, bilingual body.

| File | Tone | Subject |
|------|------|---------|
| `paystack-v2-try.html` | Softer — invite to test v2 | Test Paystack v2 / Testez Paystack v2 |
| `paystack-v2-direct.html` | Direct — ask them onto v2 this week | Paystack v2 is ready for [Restaurant name] |

**Before sending:** find-replace `[First name]` and `[Restaurant name]`.

**Preview:** open the HTML file in a browser.

**Send:** paste the HTML into Gmail (compose → ⋮ → Plain text off, or a mail tool that accepts HTML). Logo loads from `https://www.paystack.ch/brand/…` so it works in the inbox.

Colours match `shared/brandAssets.ts`: red `#E8423F`, charcoal `#2B2B2B`, cream `#FFF5F4`.
