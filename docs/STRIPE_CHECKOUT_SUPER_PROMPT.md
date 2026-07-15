# Stripe checkout / trial — Super Prompt

Use this when checkout shows **“Your card was declined”** on a **CHF 0.00 trial** with **no bank verification SMS** — the card never reached the issuer.

---

## Symptom (Josh / QA)

- Stripe Hosted Checkout: **Total due today CHF 0.00** (7-day trial)
- User enters a **real** Visa/Mastercard
- Error: **“Your card was declined. Please try a different card.”**
- **No 3-D Secure / bank app prompt** — money is on **Stripe configuration**, not the card

---

## Customer vs admin sandbox

| Surface | Stripe mode |
|---------|-------------|
| `/app` paywall (`SubscriptionGate`), `/start-trial`, `/sign-in`, `/sign-up`, landing CTAs | **Live only** — never `stripe_test=1`, never `/api/stripe-test/*` |
| `/admin` → Operator tab | Live + **Test checkout** buttons (explicit admin QA) |

Customer flows ignore `VITE_STRIPE_USE_TEST` and strip `?stripe_test=1` on `/app`. Sandbox banners and env-var errors are **not** shown to customers.

See also `docs/TEAM_SIGN_IN_SUPER_PROMPT.md` (team routes) and `client/src/cafe/lib/stripeCheckoutClient.ts` (`customerStripeBillingPath`).

---

## Root cause #1 (most common): Test mode + real card

If **any** of these are true on **production** (`paystack.ch`), Checkout uses **`sk_test_...`**:

| Env (Vercel) | Effect |
|--------------|--------|
| `VITE_STRIPE_USE_TEST=true` | Client sends `stripeTest: true` on every checkout (**rebuild required**) |
| `STRIPE_USE_TEST_MODE=true` | Server forces test keys even without client flag |
| URL `?stripe_test=1` | Sandbox for that session |

**Real cards always fail in test mode** — Stripe simulates decline **without** contacting the bank.

### Fix

1. Vercel → Project → Settings → Environment Variables (**Production**)
Removing **`STRIPE_USE_TEST_MODE`** from Vercel Production is **correct and recommended** — production checkout must use `sk_live_...` only. Keep sandbox for local QA via `?stripe_test=1` only.

2. **Remove** or set to `false`: `VITE_STRIPE_USE_TEST`, `STRIPE_USE_TEST_MODE` (delete the var entirely)
3. Ensure **Production** has:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_PRICE_STARTER` / `BUSINESS` / `UNLIMITED` = **live** Dashboard `price_...` IDs (CHF, recurring)
4. **Redeploy** (Vite bakes `VITE_*` at build time)

Intentional sandbox on production: `?stripe_test=1` or set `STRIPE_ALLOW_TEST_ON_PRODUCTION=true` (not recommended for public marketing links).

---

## Root cause #2: Key / price mismatch

| Misconfig | Result |
|-----------|--------|
| `sk_live_` + `STRIPE_TEST_PRICE_*` | Session create error or wrong account |
| `sk_test_` + live `STRIPE_PRICE_*` | Session create error |
| `price_` from **another** Stripe account | “No such price” at create |
| One-time price (not recurring) | Broken subscription checkout |
| USD/EUR price instead of CHF | Wrong currency / compliance issues |

### Fix

1. Stripe Dashboard → **Live mode** → Products → copy **monthly CHF** Price IDs
2. Paste into Vercel `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_UNLIMITED`
3. Webhooks: register **both**
   - `https://paystack.ch/api/stripe/webhook`
   - `https://www.paystack.ch/api/stripe/webhook`
4. Put both `whsec_` secrets in `STRIPE_WEBHOOK_SECRET` (comma-separated) or use `STRIPE_WEBHOOK_SECRET_ALT`

---

## Root cause #3: Live account not ready

- Stripe Dashboard → **Activate payments** (identity, bank account)
- **Radar** rules blocking $0 setup — check Developers → Events for `setup_intent.setup_failed`
- Card issuer declines **$0 verification** (rare) — try another card or force 3DS (code sets `request_three_d_secure: any`)

---

## Code paths (this repo)

| Step | File |
|------|------|
| Guest trial redirect | `client/src/pages/StartTrialPage.tsx` |
| Client checkout POST | `client/src/cafe/lib/stripeCheckoutClient.ts` → `POST /api/stripe/guest-trial-checkout` |
| Session create | `lib/stripeCore.ts` → `runCreateCheckoutSessionGuest` |
| Shared session params | `lib/stripeCheckoutSession.ts` |
| Auth checkout | `lib/stripeBilling.ts` → `runCreateCheckoutSession` |
| Post sign-up link | `api/stripe/link-checkout-session` + `SignUpPage.tsx` |
| Webhooks | `api/stripe/webhook.ts` → `lib/stripeBilling.ts` |

Checkout response includes `stripeMode: "live" | "test"` and `sessionId` for Dashboard lookup.

---

## QA checklist

### Production live trial (real card)

- [ ] Vercel Production: **no** `VITE_STRIPE_USE_TEST`, **no** `STRIPE_USE_TEST_MODE`
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_`
- [ ] Price IDs are live CHF recurring `price_...`
- [ ] Open `/start-trial?plan=starter` → Stripe shows **CHF 29/mo**, **CHF 0.00 today**
- [ ] Real card → **3DS / bank app** may appear → success → `/sign-up?checkout=success&session_id=...`
- [ ] Stripe Dashboard → Customers → subscription **trialing**

### Sandbox (test card only)

- [ ] `?stripe_test=1` or `VITE_STRIPE_USE_TEST=true` (preview only)
- [ ] Use Stripe test card `4242 4242 4242 4242` — **not** a real card
- [ ] `STRIPE_TEST_SECRET_KEY` + `STRIPE_TEST_PRICE_*`

### Joshua plan test (no Stripe)

- [ ] `joshua@the-leadlab.com` → plan picker bypass — see `docs/PLAN_TEST_SUPER_PROMPT.md`

---

## Debug a failed attempt

1. Stripe Dashboard → **Developers → Events** (match **Live** vs **Test** toggle to checkout)
2. Search `checkout.session` or customer email
3. Open `setup_intent.setup_failed` → read `decline_code`
4. Compare API key mode on session vs env in Vercel

---

## Env reference

```env
# Production (live charges after trial)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_BUSINESS=price_...
STRIPE_PRICE_UNLIMITED=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
# STRIPE_WEBHOOK_SECRET_ALT=whsec_...   # www host
STRIPE_TRIAL_DAYS=7
PUBLIC_APP_URL=https://paystack.ch

# Do NOT set on production unless intentional:
# VITE_STRIPE_USE_TEST=true
# STRIPE_USE_TEST_MODE=true

# Sandbox only
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PRICE_STARTER=price_...
```
