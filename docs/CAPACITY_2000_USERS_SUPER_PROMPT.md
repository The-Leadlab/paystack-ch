# Capacity test — 2000 active users — Super Prompt

Use when validating whether Paystack.ch can sustain **~2000 concurrent active users** across Starter / Business / Unlimited (and a mixed cohort).

**Safety:** Do **not** create 2000 real Stripe checkouts or 2000 Firebase Auth users against production. This harness is a **local simulation + optional HTTP smoke** of entitlement logic, concurrency, and API surface.

Related: `shared/planCatalog.ts`, `docs/TEAM_INVITE_SUPER_PROMPT.md`, `docs/STRIPE_CHECKOUT_SUPER_PROMPT.md`.

---

## Goals

1. Run **2000 virtual users (VUs)** on **Starter**, then **Business**, then **Unlimited**.
2. Run **2000 VUs mixed** across the three plans.
3. Measure latency (p50 / p95 / p99), throughput, entitlement rejections, and hard errors.
4. Flag bottlenecks (doc caps, session caps, seat caps, Gemini cost risk on Unlimited).

---

## Agent instructions (copy-paste)

```
Apply docs/CAPACITY_2000_USERS_SUPER_PROMPT.md locally.

1. Commit unrelated work first if the user asked.
2. Run: node scripts/capacity-test-2000.mjs
   Optional: CAPACITY_BASE_URL=http://127.0.0.1:3000 node scripts/capacity-test-2000.mjs
3. Do NOT hit production Stripe or create real Firebase users.
4. Write results JSON under scripts/capacity-results/ and summarize errors + plan differences.
5. Do not push unless asked.
```

---

## Scenarios

| ID | Cohort | N | Focus |
|----|--------|---|-------|
| A | All Starter | 2000 | Doc 35, sessions 2, seats 1 |
| B | All Business | 2000 | Doc 120, seats 10, unlimited sessions |
| C | All Unlimited | 2000 | No doc/session/seat caps (AI cost risk) |
| D | Mixed ~1/3 each | 2000 | Cross-plan contention |

Each VU performs a burst of: resolve entitlements → check session add → check doc upload → check personal upload → check team invite → synthetic “dashboard refresh” work.

---

## Code

| Piece | Path |
|-------|------|
| Harness | `scripts/capacity-test-2000.mjs` |
| Results | `scripts/capacity-results/*.json` |
| Plans | `shared/planCatalog.ts` |

---

## QA / pass criteria (local sim)

- [ ] 0 uncaught exceptions in harness
- [ ] Starter: doc/session/seat **limit rejections** appear when VU exceeds caps (expected, not errors)
- [ ] Business/Unlimited: far fewer entitlement rejections
- [ ] Mixed: results show per-plan breakdown
- [ ] Optional HTTP probe: failure rate &lt; 1% against local Vite when `CAPACITY_BASE_URL` set

---

## Out of scope

- Real Firebase Auth / Firestore production write storm
- Real Gemini document analysis × 2000
- Real Stripe Checkout × 2000
