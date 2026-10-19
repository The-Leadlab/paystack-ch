# Personal — hide from public / Dev admin only — Super Prompt

**Status:** applied. Personal must not be promoted until explicitly re-enabled.

## Goal

Keep the Personal product (`/personal`, CHF 20 plan) available for **dev admin testing** only — do not sell or advertise it to customers.

## Rules

1. **Dev admin email:** `ali@the-leadlab.com` only (`PERSONAL_DEV_ADMIN_EMAIL` in `shared/personalProductAccess.ts`).
2. **Public flag:** `PERSONAL_PRODUCT_PUBLICLY_AVAILABLE = false` until product approval in chat.
3. While the flag is false:
   - No Personal CTA on landing hero, pricing tabs, modules, or platform tour
   - `/start-trial?product=personal` redirects home
   - Stripe guest + authenticated checkout reject `planId === "personal"`
   - `/personal` only for the personal-finances allowlist (dev admin)
   - Business sidebar “Personal finances” link only for that allowlist
4. Dev admin sees **Dev admin** (not “Admin panel”) in the `/app` sidebar when opening `/admin`.
5. Do **not** expand the personal allowlist or flip the public flag without explicit user approval.

## Key files

| Piece | Location |
|-------|----------|
| Public flag + email | `shared/personalProductAccess.ts` |
| Allowlist / `isDevAdminUser` | `client/src/cafe/lib/subscriptionBypass.ts` |
| Route gate | `client/src/pages/PlatformPage.tsx` |
| Landing hide | `HeroSection`, `PricingSection`, `ModulesSection`, `PlatformTourSection` |
| Checkout block | `lib/stripeCore.ts`, `lib/stripeBilling.ts`, `StartTrialPage.tsx` |

## Re-promote later

1. User approves in chat.
2. Set `PERSONAL_PRODUCT_PUBLICLY_AVAILABLE = true`.
3. Restore landing Personal surfaces from `docs/PERSONAL_PRODUCT_SUPER_PROMPT.md`.
4. Re-expand allowlist / Unlimited bridge as product specifies.
