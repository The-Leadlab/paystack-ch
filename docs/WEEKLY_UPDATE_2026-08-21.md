# 📋 Paystack.ch — Weekly Update (21 Aug 2026)

**Period covered:** 14–21 Aug 2026 · **Main:** `7a96bc5` · **Volume:** 23 commits

---

### 1. Client Brief

Paystack.ch is a Swiss restaurant/hospitality financial SaaS (React + Vite + Firebase + Gemini + Stripe). Business users run `/app` (sessions, documents, VAT, revenue/expenses, payroll). Household users run a separate **Personal** product on `/personal` (CHF 20 plan, statement upload, budgets, goals — never mixed into Business Revenue). Ali lab (`/ali`) holds competitor-gap prototypes that must not auto-promote into `/app`. Open Banking / live bank sync stays out of scope; manual CSV/PDF statement upload is allowed for Personal.

**This week’s GTM angle:** Geneva SME **beta outreach** — zero-cost trial, ~CHF 5–10k/year expense savings, 25% launch discount, bilingual FR/EN invite letters with upload-demo GIF and Salaire posters.

---

### 2. What has been done?

✅ **Admin cold outreach** — CSV upload, HTML or plain text, preview, Resend send (`POST /api/admin/outreach`)  
✅ **Geneva beta invite** — bilingual professional letters; branded HTML wrapper; Make.com preset `beta-invite`  
✅ **Outreach assets** — upload-demo GIF + PNG on `paystack.ch/outreach/`; FR + EN Salaire posters  
✅ **Platform mailboxes** — `joshua@paystack.ch` and `lucas@paystack.ch`; admin selects From address  
✅ **Outreach polish** — theme-aware logos (light/dark), platform fonts, inbox-friendly From name + subject hook  
✅ **Beta plan-test fix** — plan-test users no longer hit subscription paywall  
✅ **Branding fixes** — on-dark PayStack.ch lockup; landing double-logo stack; screenshots refreshed to match `/app`  
✅ **Personal sidebar** — Sessions control no longer overlaps PayStack lockup  
✅ **Onboarding + tours** — chrome matched to dashboard theme  
✅ **Stability** — dashboard crash from `sidebarCollapsed` init order; sign-in shows “Wrong password” instead of Firebase error codes  
✅ **Tests** — outreach mail unit tests (`test/outreachMail.test.ts`)

---

### 3. What is left to do?

🔲 **Beta outreach execution** — send Geneva SME list, track replies/signups, iterate copy from real feedback  
🔲 **Invoice Maker** — templates, numbering, recurring (next roadmap epic per features status doc)  
🔲 **Ali lab promotion decision** — shared-access, automation-rules, offline, DE/IT i18n remain lab/`ready` until explicit chat approval  
🔲 **Production QA** — outreach deliverability (Resend), beta user onboarding path, Personal statement → Drive  
🔲 **Firestore rules deploy check** — confirm personal / `ali_lab_*` rules live so cloud sync is not silently device-only  
🔲 **Competitor-gap backlog (pending)** — multi-currency ledger, push bill reminders, cost-of-living guidelines, loan/retirement tools  
🔲 **Capacity phase 2 (optional)** — real Firestore write storms / Gemini / Stripe under load  
🔲 **Open Banking / live bank sync** — **not planned** (product out of scope)

---

### 4. Bottleneck issues

⚠️ **Promotion gate** — biggest process blocker. Lab features stay sandbox until you approve promotion in chat after `/ali` testing; agents must not mark `promoted` or wire into `/app` alone.  
⚠️ **Outreach ops** — cold sends depend on verified Resend mailboxes and manual CSV workflow; no integrated CRM or reply tracking yet.  
⚠️ **Beta feedback loop** — outreach copy is polished but needs real Geneva SME responses to validate conversion and onboarding friction.  
⚠️ **Open Banking out of scope** — no live bank sync; Personal depends on manual file upload + Drive backup.  
⚠️ **Cloud sync / rules mismatch risk** — soft UX shipped, but owners/invitees may still get local-only Budget if production rules don’t match expectations.  
⚠️ **Pre-existing TS / Prettier debt** — noisy baseline checks; not treated as this week’s regressions.

**Next week focus:** beta outreach results → decide Ali lab promotions → Invoice Maker sprint → verify Firestore rules on production.

---

*WhatsApp copy-paste format:* [`docs/weekly-updates/2026-08-21-whatsapp.md`](./weekly-updates/2026-08-21-whatsapp.md)
