# Capacity test results — 2000 active users

**Date:** 2026-08-05 (UTC)  
**Verdict:** **PASS** — 0 hard errors across all four cohorts  
**Harness:** `scripts/capacity-test-2000.mjs`  
**Super prompt:** `docs/CAPACITY_2000_USERS_SUPER_PROMPT.md`  
**Raw JSON (local, gitignored):** `scripts/capacity-results/latest.json`  
**Run stamp:** `2026-08-05T13:02:06.543Z`

---

## Setup

| Parameter | Value |
|-----------|--------|
| Virtual users per scenario | 2000 |
| Concurrency | 200 |
| HTTP base URL | `http://127.0.0.1:3000` (Vite dev) |
| HTTP probes per scenario | 200 (`/`, `/sign-in`, `/start-trial?plan=starter`) |
| Plans tested | Starter → Business → Unlimited → Mixed (~⅓ each) |

**What was tested**

- Plan entitlement resolution (`maxDocumentsPerMonth`, personal docs, sessions, team seats)
- Concurrent “active user” bursts (uploads, session add, invite attempts, dashboard fold)
- Local SPA HTTP availability under probe load

**What was not tested (out of scope)**

- Creating 2000 real Firebase Auth users
- Production Firestore write storms
- Real Gemini document analysis × 2000
- Real Stripe Checkout × 2000

---

## Overall verdict

| Check | Result |
|-------|--------|
| Hard / unexpected errors | **0** (all scenarios) |
| Failed virtual users | **0** |
| HTTP probe success | **800 / 800** (100%) |
| Starter product caps | Enforced as designed (session + seat) |
| Business / Unlimited caps | No rejections under this burst profile |
| Mixed isolation | All limit hits came from the Starter third only |

---

## Scenario results

### A — Starter × 2000

| Metric | Value |
|--------|--------|
| Wall clock | 10.5 s |
| Throughput | ~191 VU/s |
| Sim latency p50 / p95 / p99 | 0.014 / 0.025 / 0.108 ms |
| Hard errors | 0 |
| Product limit hits | **8000** |
| Limit breakdown | `maxSessions` 4000 · `maxTeamSeats` 4000 |
| HTTP | 200/200 ok · p95 **7509.8 ms** (cold first wave) |

**Analysis:** Starter caps (2 sessions, 1 seat) fired exactly as expected. Limit hits are **not** failures — they prove enforcement works under concurrent load.

### B — Business × 2000

| Metric | Value |
|--------|--------|
| Wall clock | 7.8 s |
| Throughput | ~257 VU/s |
| Sim latency p50 / p95 / p99 | 0.016 / 0.026 / 0.059 ms |
| Hard errors | 0 |
| Product limit hits | **0** |
| HTTP | 200/200 ok · p95 **2852.1 ms** |

**Analysis:** Burst profile (a few docs/invites per VU) stays inside Business headroom (120 docs/mo, 10 seats, unlimited sessions). No entitlement bugs observed.

### C — Unlimited × 2000

| Metric | Value |
|--------|--------|
| Wall clock | 3.1 s |
| Throughput | ~648 VU/s |
| Sim latency p50 / p95 / p99 | 0.015 / 0.028 / 0.041 ms |
| Hard errors | 0 |
| Product limit hits | **0** (no doc/session/seat caps) |
| HTTP | 200/200 ok · p95 **833.6 ms** |

**Analysis:** Entitlement path is clean. **Production risk** for Unlimited is Gemini/Firestore cost under real AI document volume, not the plan-check code path.

### D — Mixed × 2000 (~667 Starter / 667 Business / 666 Unlimited)

| Metric | Value |
|--------|--------|
| Wall clock | 2.6 s |
| Throughput | ~767 VU/s |
| Sim latency p50 / p95 / p99 | 0.016 / 0.030 / 0.052 ms |
| Hard errors | 0 |
| Product limit hits | **2668** (Starter only) |
| Limit breakdown | `maxSessions` 1334 · `maxTeamSeats` 1334 |
| HTTP | 200/200 ok · p95 **750.0 ms** |

**Per-plan in mixed**

| Plan | Users | Limit hits | Hard errors |
|------|------:|-----------:|------------:|
| Starter | 667 | 2668 | 0 |
| Business | 667 | 0 | 0 |
| Unlimited | 666 | 0 | 0 |

**Analysis:** Cross-plan concurrent entitlement resolution stays consistent; Business/Unlimited VUs did not inherit Starter rejections.

---

## Error analysis

### Hard errors

None. No entitlement mismatches, parse failures, or non-finite dashboard folds.

### Expected limit rejections (not errors)

| Kind | Where | Meaning |
|------|--------|---------|
| `maxSessions` | Starter (solo + mixed) | Cap of 2 sessions enforced |
| `maxTeamSeats` | Starter (solo + mixed) | Cap of 1 seat (owner only) enforced |

### HTTP notes

- All probes returned success once Vite was up.
- First scenario’s HTTP p95 (~7.5 s) reflects **cold Vite / first-compile** cost under concurrent probes, not production CDN latency.
- Later scenarios warmed down to ~0.75–2.9 s p95 on the same local server.

---

## Capacity conclusions

1. **Plan entitlement engine** handles 2000 concurrent VUs per cohort with **0 hard errors**.
2. **Starter limits** behave correctly under load (sessions + seats).
3. **Business** and **Unlimited** do not false-reject under this burst profile.
4. **Mixed plans** do not cross-contaminate limit enforcement.
5. Local SPA serves 800 probes without failures; treat cold-start latency as a local-dev artifact.
6. For a real launch at ~2000 active users, still plan a **staging** load test for Firestore writes, Gemini rate limits, and Vercel function concurrency — those layers are outside this harness.

---

## How to re-run

```bash
# Simulation only
pnpm test:capacity

# With local Vite HTTP probes
# Terminal A: pnpm dev
# Terminal B:
CAPACITY_BASE_URL=http://127.0.0.1:3000 pnpm test:capacity
```

Optional knobs: `CAPACITY_USERS`, `CAPACITY_CONCURRENCY`.

---

## Related files

| File | Role |
|------|------|
| `docs/CAPACITY_2000_USERS_SUPER_PROMPT.md` | Agent instructions |
| `scripts/capacity-test-2000.mjs` | Harness |
| `shared/planCatalog.ts` | Source of plan caps |
| `scripts/capacity-results/` | Local JSON outputs (gitignored) |
