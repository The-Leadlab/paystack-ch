# Personal Product + Landing + Admin — Super Prompt

Use this when shipping **Paystack Personal** as its own paid product (separate from restaurant/business), updating admin, landing, currency display, and Stripe branding notes.

**Status:** phased. Agents implement **one phase at a time**, keep restaurant billing working, and do not mark personal as `promoted` into default `/app` flows beyond what each phase specifies.

---

## Goal (one sentence)

**Sell Personal at CHF 20/mo with its own Stripe trial checkout, seat/doc add-ons, admin lists, and landing tab — while restaurant stays on Starter/Business/Unlimited, with Unlimited able to open Personal.**

---

## Product model (source of truth)

### Two product lines

| Line | Plan IDs | Entry | App shell |
|------|----------|-------|-----------|
| **Restaurant / Platform** | `starter`, `business`, `unlimited`, `enterprise` | `/start-trial?plan=…` or landing Business pricing | `/app` |
| **Personal** | `personal` | `/start-trial?product=personal` (or `/start-personal`) | `/app/personal/*` |

Firestore `users/{uid}` should carry:

- `planId` — as today
- `productLine`: `"restaurant" | "personal"` (derive from `planId === "personal"` if missing)
- Existing Stripe fields unchanged (`subscriptionId`, `subscriptionStatus`, `stripeCustomerId`, …)
- Personal add-ons (optional): `personalAddonSeats` (number of paid seats beyond included), `personalDocPack` (`none` | `100`)

### Personal pricing (CHF — list prices)

| SKU | Price | Notes |
|-----|-------|--------|
| Personal base | **CHF 20 / month** | 7-day trial like restaurant; Stripe Checkout |
| Included seats | **Owner + 1 invite free** | `maxTeamSeats` base = **2** |
| Extra seat (2nd invite and each further) | **CHF 5 / month** each | Stripe recurring price addon or quantity on seat price |
| Included personal docs | **35 / month** | Same cap as current personal usage |
| Doc pack | **CHF 8 / month → 100 docs/mo** | Replaces 35 while active (`maxPersonalDocumentsPerMonth = 100`) |

Restaurant catalog **unchanged**: Starter 29 / Business 59 / Unlimited 499.

### Access rules

1. **Personal-only subscriber** (`planId === "personal"`): full `/app/personal/*`; **no** restaurant modules on `/app` (redirect to personal or a soft “Business plans” upsell).
2. **Restaurant subscriber** (starter/business/unlimited): `/app` as today.
3. **Unlimited restaurant**: show a clear control (“Open personal finances”) → `/app/personal` **without** requiring a second Personal subscription (bridge entitlement). Still subject to personal doc caps unless Unlimited later gets a higher personal doc entitlement (default keep 35 unless product says otherwise).
4. Remove email allowlist as the *only* gate once Personal Stripe + Unlimited bridge ship; keep allowlist as **ops bypass** only.
5. Team invites on Personal: enforce seat math (2 included; 3rd person needs paid seat addon).

### Admin (`/admin` users)

1. Split lists (tabs or two sections): **Platform (restaurant)** vs **Personal**.
2. Within each list: **Active first** (`trialing`, `active`, `past_due`), then **Inactive** (`canceled`, `none`, Auth `disabled`, incomplete).
3. Do not mix personal-only customers into platform primary view without a filter.

### Currency

1. Add a shared display-currency helper (detect from `taxRegion`, `navigator.language`, optional user preference).
2. Default billing currency for Stripe remains **CHF** until multi-currency Price IDs exist.
3. Format money across landing, billing, personal, restaurant with `formatMoney(amount, currency)` — stop hardcoding `"CHF"` in new UI.
4. Detection must not change Stripe charge currency without matching Price IDs.

### Landing

1. Pricing (and preferably hero CTA) has **Business | Personal** tabs.
2. Personal tab: CHF 20 card, seat/doc copy, CTA → personal Stripe trial.
3. Business tab: existing four tiers.
4. Refresh imagery to match real product surfaces (dashboard, personal tabs, documents) — analyze `RestaurantDashboard` + `personalPlanNav` for missing module callouts.
5. Follow existing brand language (Paystack.ch); avoid generic purple/cream AI aesthetics.

### Stripe Checkout name shows “Lead Lab”

**Usually Dashboard, not app code.** Checklist for the account owner:

1. Stripe Dashboard → **Settings → Public business information** → Legal / public business name → **Paystack.ch** (or SpaceTag if that is the legal brand you want on receipts).
2. **Settings → Branding** → logo, icon, brand color (you already added SpaceTag logo — confirm this is the **live** mode account, not only test).
3. **Settings → Customer portal** / email receipts — same account.
4. **Statement descriptor** (bank statement): Settings → Public info / payouts → statement descriptor (max length rules apply). App cannot fully override the account’s public name on Hosted Checkout.
5. Confirm you are looking at **Live** mode if production payments show Lead Lab.
6. Optional code: ensure Checkout `line_items` / Product `name` use `Paystack Personal` / `Paystack Starter` (already partly done for restaurant). Do **not** put Lead Lab in product names.

---

## Env vars (add)

```
STRIPE_PRICE_PERSONAL=
STRIPE_TEST_PRICE_PERSONAL=
STRIPE_PRICE_PERSONAL_SEAT=          # CHF 5 / seat / month
STRIPE_TEST_PRICE_PERSONAL_SEAT=
STRIPE_PRICE_PERSONAL_DOC_PACK=      # CHF 8 / month → 100 docs
STRIPE_TEST_PRICE_PERSONAL_DOC_PACK=
```

Create matching Products/Prices in Stripe Dashboard (CHF, recurring monthly) before enabling checkout in production.

---

## Phases (implement in order)

### Phase 1 — Catalog + types
- Extend `PaystackPlanId` with `"personal"`.
- `PLAN_MONTHLY_PRICE_CHF.personal = 20`.
- Entitlements: personal docs 35, team seats 2, restaurant docs 0/N/A, no restaurant-only flags.
- Constants: `PERSONAL_INCLUDED_SEATS = 2`, `PERSONAL_EXTRA_SEAT_CHF = 5`, `PERSONAL_DOC_PACK_CHF = 8`, `PERSONAL_DOC_PACK_LIMIT = 100`.
- `stripePriceIdForPlan('personal')`, `parsePaystackPlanId`, marketing keys stub.
- Update `.env.example`.

### Phase 2 — Stripe personal checkout
- Guest/authenticated checkout path with `planId: personal` / `productLine: personal`.
- Separate start URL from restaurant; trial 7 days; cancel rules same as restaurant (immediate on trial).
- Webhook sync sets `planId: personal`, `productLine: personal`.
- Portal + cancel work for personal subscriptions.

### Phase 3 — App separation + Unlimited bridge
- Gate `/app` vs `/app/personal` by product line + Unlimited bridge.
- Billing UI for personal (cancel, upgrade doc pack, add seat).
- Dashboard control for Unlimited → Personal.
- Invite: first invite free within seat 2; block or checkout for seat 3+ at CHF 5.

### Phase 4 — Admin
- Separate Personal vs Platform user lists; active then inactive sorting.

### Phase 5 — Multi-currency display
- Shared currency detection + formatters; wire high-traffic surfaces.

### Phase 6 — Landing
- Business | Personal tabs; imagery; missing module tabs; Personal CTA.

### Phase 7 — Branding verification doc
- Confirm Dashboard checklist above; fix any in-repo product display names.

---

### Stripe Dashboard — create Personal prices (ops)

1. Stripe Dashboard → **Products** → Add product **Paystack Personal** → recurring **CHF 20 / month**. Copy Price ID → `STRIPE_PRICE_PERSONAL` (and test twin → `STRIPE_TEST_PRICE_PERSONAL`).
2. Product **Paystack Personal Extra Seat** → recurring **CHF 5 / month** → `STRIPE_PRICE_PERSONAL_SEAT`.
3. Product **Paystack Personal Doc Pack** → recurring **CHF 8 / month** → `STRIPE_PRICE_PERSONAL_DOC_PACK`.
4. Set the same on Vercel (Production + Preview). Numeric `20` / `5` / `8` still work in code (Checkout `price_data` / lookup_key auto-create for add-ons), but **Price IDs are preferred**.
5. Branding: Settings → Public business information + Branding (live mode) so Checkout does not show Lead Lab.

### Progress (implementation)

- [x] Phase 1 catalog + Phase 2/3 gates + admin split + landing Business|Personal tabs
- [x] `POST /api/stripe/personal-addon` — add seat or doc pack on existing Personal subscription
- [x] Personal overview add-on UI; seats respect `personalAddonSeats` in invites
- [x] Modules landing tab for Personal features
- [ ] Wire `formatMoney` across all restaurant dashboard surfaces (helper ready; personal UI uses detection)
- [ ] Create live Stripe Price IDs in Dashboard (ops)

---

## Agent instructions (copy-paste)

```
Apply docs/PERSONAL_PRODUCT_SUPER_PROMPT.md one phase at a time.

Rules:
1. Do not break restaurant Starter/Business/Unlimited checkout or entitlements.
2. Personal is planId "personal" at CHF 20; seats 2 included; extra seat CHF 5; doc pack CHF 8 → 100 docs.
3. Separate Stripe price env vars; never reuse restaurant price IDs for personal.
4. Unlimited restaurant may open /app/personal; personal-only must not get full restaurant /app.
5. Admin: Platform vs Personal; active users above inactive.
6. Currency detection is display-first; Stripe stays CHF until multi-currency prices exist.
7. Lead Lab on Checkout → document Stripe Dashboard branding; fix product names in code if wrong.
8. Prefer small PRs / commits per phase. Run relevant checks after each phase.
9. Open Banking / live bank sync stay out of scope.
10. Do not set ali-lab features to promoted unless user explicitly approves.
```

---

## Test checklist (cumulative)

- [ ] Catalog exposes personal @ 20 CHF and addon constants
- [ ] Personal Checkout trial CHF 0 today, then 20/mo (with Price ID configured)
- [ ] Personal cancel during trial → no charge
- [ ] Personal-only user lands in `/app/personal`, not restaurant modules
- [ ] Unlimited user sees Personal entry and can open it
- [ ] Invite #1 succeeds without seat addon; invite #2 requires CHF 5 path when seats would exceed 2
- [ ] Doc pack sets personal cap to 100
- [ ] Admin shows Personal and Platform groups; actives first
- [ ] Landing Personal tab shows 20 CHF and correct CTA
- [ ] Money formatting respects detected/display currency where wired
- [ ] Stripe live branding checklist completed by account owner

---

## Out of scope

- Open Banking / live bank sync
- Replacing restaurant prices
- Ali lab → production promotion without explicit approval
- Changing Stripe legal entity (Dashboard only)
