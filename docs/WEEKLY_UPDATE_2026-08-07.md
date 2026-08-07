# 📋 Paystack.ch — Weekly Update (7 Aug 2026)

**Period covered:** 3–7 Aug 2026 · **Main:** `444bb18`

---

### 1. Client Brief

Paystack.ch is a Swiss restaurant/hospitality financial SaaS (React + Vite + Firebase + Gemini + Stripe). Business users run `/app` (sessions, documents, VAT, revenue/expenses, payroll). Household users run a separate **Personal** product on `/personal` (CHF 20 plan, statement upload, budgets, goals — never mixed into Business Revenue). Ali lab (`/ali`) holds competitor-gap prototypes that must not auto-promote into `/app`. Open Banking / live bank sync stays out of scope; manual CSV/PDF statement upload is allowed for Personal.

---

### 1. What has been done?

✅ Personal product line live: CHF 20 plan, seats (1 free invite + CHF 5 extras), doc pack, admin Platform vs Personal, landing Business|Personal tabs  
✅ Personal routed to `/personal/*` (split from business `/app`)  
✅ Bank statement CSV/PDF import + AI fill across tabs; sessions; 35-doc cap; IndexedDB + Firestore persist  
✅ Personal Google Drive backups under `Paystack Documents / Personal / YYYY-MM-DD /` (+ fixtures/E2E path)  
✅ Household invites (modal, seat paywall, membership/contrast fixes)  
✅ Personal Settings tab; Overview declutter; Budget cloud-sync soft-fail UX  
✅ Business Expenses hub (mirrors Revenue analytics)  
✅ Per-item invoice line verification + admin user-settings UX  
✅ Fix duplicate pending+completed documents after refresh  
✅ Team email invites + seat caps; in-app owner plan cancel; admin bulk / no Stripe in Admin–test mode  
✅ 2000-VU capacity harness documented **PASS** (entitlements + SPA probes; not live Firebase/Gemini/Stripe storm)  
✅ Collapsible icon-rail sidebars on Personal **and** Business (dashboard expands)  
✅ Separate Personal & Business onboarding; short vs long vs skip product tours (QA replay for `ali@the-leadlab.com`)  
✅ Personal visual parity with Business (CDLP colors, Inter, uppercase tabs, rail button chrome)  
✅ Landing refresh (Expenses / Personal tour imagery, V3 screenshots)

---

### 1. What is left to do?

🔲 Production/main QA pass: onboarding (short + long), Business rail collapse, Personal statement → Drive → Settings (Ali test account)  
🔲 Explicit decision: which `/ali` lab features to promote into `/app` (automation, shared-access, offline, DE/IT) — **blocked on your approval after lab testing**  
🔲 Wire/merge DE–IT i18n into main `/app` beyond personal lab  
🔲 Invoice maker + POS depth vs “in progress” competitor matrix  
🔲 Optional capacity phase 2: real Firestore write storms / Gemini / Stripe under load  
🔲 Confirm production Firestore rules for personal / `ali_lab_*` so cloud sync is not silently device-only  
🔲 Competitor-gap backlog (pending): multi-currency ledger, push bill reminders, cost-of-living guidelines, loan/retirement tools, richer auto-budget-from-history  
🔲 Open Banking / live bank sync — **not planned** (product out of scope)

---

### 1. Bottleneck issues

⚠️ **Promotion gate** — biggest process blocker. Lab features stay sandbox until you approve promotion in chat after `/ali` testing; agents must not mark `promoted` or wire into `/app` alone.  
⚠️ **Open Banking out of scope** — no live bank sync; Personal depends on manual file upload + Drive backup.  
⚠️ **Cloud sync / rules mismatch risk** — soft UX shipped, but owners/invitees may still get local-only Budget if production rules don’t match `restaurantId` / personal ledger expectations.  
⚠️ **Capacity PASS ≠ production load proof** — harness did not create 2000 real Auth users or hammer Gemini/Stripe.  
⚠️ **Env/auth for full browser smoke** — invalid Firebase Analytics key / missing credentials can hide authenticated UI in agent environments.  
⚠️ **Tour/onboarding one-shot** — skip/complete hides guides forever for normal users (by design); only `ali@the-leadlab.com` auto-replays for QA.  
⚠️ **Pre-existing TS / Prettier debt** — noisy baseline checks; not treated as this week’s regressions.

**Next week focus:** Ali QA on main (tours + rails + Personal Drive path) → decide lab promotions → verify Firestore rules on production → pick one epic (i18n DE/IT, invoice/POS polish, or capacity phase 2).

---

*Full narrative checklist also at `docs/WEEKLY_RESUME_2026-08-03_TO_2026-08-07.md`.*
