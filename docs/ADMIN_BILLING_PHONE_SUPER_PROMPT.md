# Admin user billing & phone — Super Prompt

Voice QA (Joshua, 2026-07-15) on Amy Barker’s account: missing Stripe customer ID after checkout, need clear billing dates, and Swiss phone save failed E.164.

---

## Problems

1. **Missing Stripe customer** — Firestore has plan/status but no `stripeCustomerId` (checkout link failed or partial write). Admin Invoices tab showed only “no Stripe customer ID”.
2. **Billing dates incomplete** — Operators need: subscription start, payment cycle (period start/end), last payment date, late or not.
3. **Phone E.164** — Entering `0787575993` failed Firebase Auth (“must be a non-empty E.164…”).
4. **Mobile header** — Logo wordmark overlapped “OPERATOR / Admin” on phones.

---

## Fixes

| Area | Behavior |
|------|----------|
| Phone save | Normalize CH local → `+41…` via `lib/phoneE164.ts` before `auth.updateUser` |
| Admin detail | If no customer ID, **search Stripe by email** (live then test); show invoices + subscription |
| Repair | Billing / Invoices: **Link Stripe by email** → writes customer + subscription to Firestore |
| Billing panel | Start date, period start/end, trial end, last payment, late badge |
| Mobile header | Mark-only logo (`showWordmark={false}`); title on its own row |

---

## Operator QA (Amy / similar)

- [ ] Open user without `stripeCustomerId` → Billing shows match warning **or** empty + Link button  
- [ ] **Link Stripe by email** → customer + sub saved; invoices load  
- [ ] Billing shows start / period / last payment / late status  
- [ ] Profile phone `0787575993` → saves as `+41787575993`  
- [ ] `/admin` on phone: logo and title do not overlap; EN/FR toggle readable  

---

## Code map

| Piece | Path |
|-------|------|
| Phone normalize | `lib/phoneE164.ts` |
| Admin enrich + link | `lib/adminUsers.ts` |
| Sync export | `lib/stripeBilling.ts` → `syncSubscriptionToFirestore` |
| UI | `client/src/pages/admin/AdminUserDetailPanel.tsx` |
| Header | `client/src/pages/admin/AdminLayout.tsx` |
