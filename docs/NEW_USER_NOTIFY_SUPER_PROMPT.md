# New user admin email — Super Prompt

Internal alert when someone **starts a paid trial** and links their Paystack account.

---

## Recipients (default)

| Email |
|-------|
| `joshua@the-leadlab.com` |
| `ali@the-leadlab.com` |

Override with env `NEW_USER_NOTIFY_EMAILS` (comma-separated).

---

## When email is sent

| Trigger | Source |
|---------|--------|
| Guest checkout → sign-up → link session | `checkout_link` |
| Logged-in user completes Stripe Checkout | `checkout_webhook` |

One email per Stripe session (Firestore dedupe: `adminNotifyDedup/newUser:{sessionId}`).

**Not sent** in Stripe **test** mode unless `NEW_USER_NOTIFY_IN_TEST=true`.

---

## Env (Vercel Production)

```env
RESEND_API_KEY=re_...
NEW_USER_NOTIFY_EMAILS=joshua@the-leadlab.com,ali@the-leadlab.com
NEW_USER_NOTIFY_FROM=Paystack <notifications@paystack.ch>
# Optional — same as reports if unset:
# REPORT_EMAIL_FROM=Paystack Reports <reports@paystack.ch>
```

Sender domain must be verified in [Resend](https://resend.com).

---

## Stripe production (required for real signups)

Removing **`STRIPE_USE_TEST_MODE`** from Vercel Production is **correct** — live checkout needs live keys only.

Also ensure:

- `VITE_STRIPE_USE_TEST` unset or `false` (redeploy after change)
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_PRICE_*` = live CHF `price_...` IDs

See `docs/STRIPE_CHECKOUT_SUPER_PROMPT.md`.

---

## Code

| Piece | Path |
|-------|------|
| Notify logic | `lib/newUserNotify.ts` |
| Resend helper | `lib/resendEmail.ts` |
| Webhook hook | `lib/stripeBilling.ts` → `dispatchStripeEvent` |
| Link hook | `lib/stripeBilling.ts` → `runLinkCheckoutSession` |

---

## QA

- [ ] Production env: no `STRIPE_USE_TEST_MODE`, no `VITE_STRIPE_USE_TEST`
- [ ] Resend domain verified
- [ ] Complete guest trial: checkout → sign-up → link → Joshua + Ali receive email
- [ ] Repeat same session → no duplicate email
