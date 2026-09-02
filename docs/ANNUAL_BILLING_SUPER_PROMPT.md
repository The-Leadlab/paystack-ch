# Annual billing + price roadmap — Super Prompt

**Target:** June — monthly | annual toggle on pricing; path to Unlimited; future price increases with notice.

**Today:** Landing `PricingSection` shows **CHF / month** only. Stripe checkout uses monthly recurring Price IDs from env (`STRIPE_PRICE_*`). **No annual toggle in UI.**

---

## Stripe work

1. Create yearly Prices in Stripe Dashboard (or duplicate products with `interval: year`).
2. Env: `STRIPE_PRICE_STARTER_YEAR`, `STRIPE_PRICE_BUSINESS_YEAR`, `STRIPE_PRICE_UNLIMITED_YEAR`, `STRIPE_PRICE_PERSONAL_YEAR` (+ test twins).
3. `lib/stripeCheckoutSession.ts` — accept `billingInterval: 'month' | 'year'`.
4. Checkout + Customer Portal show interval chosen on marketing page.

**Suggested retail (operator confirmed ~10% annual discount):** e.g. Unlimited CHF 499/mo → **CHF 5 390/yr** (≈2 months free). Confirm exact CHF in Stripe before June launch.

---

## UI

| Surface | Change |
|---------|--------|
| `PricingSection.tsx` | Toggle Monthly / Annual; annual shows per-month equivalent + “billed yearly” |
| `BillingPlanPanel.tsx` | Same toggle when upgrading |
| `PlanMarketingPanel` | `planMarketingPriceLine(interval)` |
| `/start-trial` | Query `?interval=year` |

---

## Unlimited upgrade campaign (June)

- In-app nudge when `documentsUsedThisMonth` > 80% of Business cap.
- CTA → Unlimited checkout (annual default for enterprise clients? operator choice).
- Admin can grant Unlimited without Stripe (`planTestMode` / bulk — existing).

---

## Price increase clause

- Terms / checkout footnote: prices may change with email notice (30 days).
- Grandfather existing Stripe subscriptions until renewal (Stripe Price migration).

---

## Acceptance

- [ ] Toggle switches displayed price and checkout Price ID.
- [ ] Webhook + Firestore store `billingInterval`.
- [ ] EN/FR for toggle labels and annual footnote.
