# Plan test sandbox — Super Prompt

Let **Joshua** (and other QA emails) sign in to Paystack.ch and **switch between Starter, Business, and Unlimited** without Stripe checkout, while enforcing **real plan entitlements** (document cap, sessions, modules).

---

## Account: joshua@the-leadlab.com

| Item | Detail |
|------|--------|
| **Sign in** | https://www.paystack.ch/sign-in — Google or email/password |
| **Account creation** | Not done in code — use Firebase Console or first Google sign-in if the account does not exist yet |
| **Paywall** | Skipped (team bypass) |
| **Email verification** | Skipped (team bypass) |
| **Entitlements** | **Not** unlimited — driven by selected `planId` on `users/{uid}` |

Joshua is in **plan test mode**, not unrestricted bypass. Ali/Kara remain full bypass (unlimited entitlements).

---

## UX flow

1. Joshua signs in → redirected to `/app`
2. If no `planId` on Firestore user doc → **modal**: choose Starter / Business / Unlimited
3. After selection → dashboard runs with that plan’s limits
4. **Gold banner** at top: current plan + **Switch plan**
5. **Billing tab** → same three buttons to change plan instantly

---

## Implementation

| Piece | Location |
|-------|----------|
| Plan test email list | `client/src/cafe/lib/subscriptionBypass.ts` — `isPlanTestUser()` |
| Apply plan (Firestore) | `client/src/cafe/lib/planTestSelection.ts` |
| Entitlements logic | `client/src/cafe/context/SubscriptionContext.tsx` |
| Modal + banner | `client/src/cafe/components/PlanTestPickerModal.tsx` |
| Dashboard wiring | `RestaurantDashboard.tsx` |
| Billing switches | `BillingPlanPanel.tsx` |

Firestore write (client, merge):

```json
{
  "planId": "starter" | "business" | "unlimited",
  "subscriptionStatus": "active",
  "planTestMode": true
}
```

---

## Env (optional)

```env
VITE_PLAN_TEST_EMAILS=joshua@the-leadlab.com,other@example.com
```

Built-in default includes `joshua@the-leadlab.com` even without env.

---

## QA checklist

- [ ] Sign in as Joshua → plan picker appears
- [ ] Select **Starter** → max 50 docs/mo, 2 sessions, no Revenue tab
- [ ] Switch to **Business** → 120 docs, advanced modules
- [ ] Switch to **Unlimited** → no doc cap
- [ ] Document usage counter still account-wide (payment-plan-fix)
- [ ] At Starter cap → upgrade modal still appears

---

## Verify account exists (Firebase Console)

1. Firebase → Authentication → Users → search `joshua@the-leadlab.com`
2. If missing: **Add user** with that email or have Joshua use **Continue with Google** on `/sign-in`

No server-side account creation in this repo without Admin SDK credentials.
