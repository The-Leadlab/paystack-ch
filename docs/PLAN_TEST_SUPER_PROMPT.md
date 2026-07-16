# Plan test sandbox — Super Prompt

Let QA emails sign in to Paystack.ch and **switch between Starter, Business, and Unlimited** without Stripe checkout, while enforcing **real plan entitlements** (document cap, sessions, modules).

---

## Joshua & Ali (not plan-test)

| Email | Role |
|-------|------|
| `joshua@the-leadlab.com` | Full subscription bypass → **unlimited** entitlements. No plan-test banner. **Admin panel** shortcut in `/app` sidebar. |
| `ali@the-leadlab.com` | Same: full bypass + **Admin panel** shortcut in `/app`. |

Configured in `client/src/cafe/lib/subscriptionBypass.ts` (`BUILT_IN_BYPASS_EMAILS`, `BUILT_IN_ADMIN_APP_ACCESS_EMAILS`). Optional env: `VITE_ADMIN_APP_ACCESS_EMAILS`.

If Joshua still sees “Mode test” in production, remove him from `VITE_PLAN_TEST_EMAILS` in Vercel and clear `planTestMode` on his Firestore `users/{uid}` doc (banner is email-list driven; Firestore flag is admin metadata only).

---

## Plan-test accounts (optional)

Add emails via:

```env
VITE_PLAN_TEST_EMAILS=qa@example.com
```

Built-in list is empty by default (Joshua was removed).

---

## UX flow (plan-test emails only)

1. Sign in → redirected to `/app`
2. If no `planId` on Firestore user doc → **modal**: choose Starter / Business / Unlimited
3. After selection → dashboard runs with that plan’s limits
4. **Banner** at top (full width, stacks on phone): current plan + **Switch plan**
5. **Billing tab** → same three buttons to change plan instantly

---

## Implementation

| Piece | Location |
|-------|----------|
| Plan test / bypass / admin app access | `client/src/cafe/lib/subscriptionBypass.ts` |
| Apply plan (Firestore) | `client/src/cafe/lib/planTestSelection.ts` |
| Entitlements logic | `client/src/cafe/context/SubscriptionContext.tsx` |
| Modal + banner | `client/src/cafe/components/PlanTestPickerModal.tsx` |
| Dashboard wiring | `RestaurantDashboard.tsx` |
| Billing switches | `BillingPlanPanel.tsx` |

Firestore write (client, merge) for plan-test users:

```json
{
  "planId": "starter" | "business" | "unlimited",
  "subscriptionStatus": "active",
  "planTestMode": true
}
```

---

## QA checklist

- [ ] Joshua / Ali: no plan-test banner; unlimited docs; **Admin panel** in `/app` sidebar → `/admin`
- [ ] Plan-test email: picker appears; Starter / Business / Unlimited caps apply
- [ ] Banner does not collapse into the left sidebar column on desktop or overflow on phone
