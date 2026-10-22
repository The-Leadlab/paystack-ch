# 📋 Paystack.ch — Weekly Update (28 Aug 2026)

**Period covered:** 21–28 Aug 2026 · **Main:** `b33e004` · **Volume:** 22 commits

---

### 1. Client Brief

Paystack.ch is a Swiss restaurant/hospitality financial SaaS (React + Vite + Firebase + Gemini + Stripe). Business users run `/app` (sessions, documents, VAT, revenue/expenses, payroll). Household users run a separate **Personal** product on `/personal` (CHF 20 plan, statement upload, budgets, goals — never mixed into Business Revenue). Ali lab (`/ali`) holds competitor-gap prototypes that must not auto-promote into `/app`. Open Banking / live bank sync stays out of scope; manual CSV/PDF statement upload is allowed for Personal.

**This week’s GTM angle:** Geneva SME **beta outreach** — outreach email hardened for Gmail (especially iOS dark mode) so the bilingual beta invite, heroes, and upload-demo GIF render correctly before live sends.

---

### 2. What has been done?

✅ **Beta outreach email rebuild** — dark campaign letter with Spinella-style full-black shell and true-black GIF  
✅ **Gmail dark/light theming** — dual light/dark heroes and GIFs; theme-aware asset defaults for desktop light vs mobile dark  
✅ **Gmail iOS fixes** — transparent body shell, no white side gutters, forced white letter text in dark mode, broken-image hardening  
✅ **Outreach GIF polish** — full dashboard frame, realistic small cursor/PDF animation, improved image spacing and filenames  
✅ **English campaign heroes** — light + dark EN hero images added alongside FR assets  
✅ **i18n** — product tour short and long guides translated; FR UI leaks fixed (insights, categories, Drive, invoices)  
✅ **Onboarding** — business and personal flows localized; Continue/Skip click targets fixed  
✅ **App UX** — product tour tap fixes; app chrome language control; Drive OAuth warning copy clarified  

---

### 3. What is left to do?

🔲 **Beta outreach execution** — send Geneva SME list, track replies/signups, iterate copy from real feedback  
🔲 **Invoice Maker** — templates, numbering, recurring (next roadmap epic per features status doc)  
🔲 **Ali lab promotion decision** — shared-access, automation-rules, offline, DE/IT i18n remain lab/`ready` until explicit chat approval  
🔲 **Production QA** — outreach deliverability on real sends (Gmail mobile), beta user onboarding path, Personal statement → Drive  
🔲 **Firestore rules deploy check** — confirm personal / `ali_lab_*` rules live so cloud sync is not silently device-only  
🔲 **Competitor-gap backlog (pending)** — multi-currency ledger, push bill reminders, cost-of-living guidelines, loan/retirement tools  
🔲 **Capacity phase 2 (optional)** — real Firestore write storms / Gemini / Stripe under load  
🔲 **Open Banking / live bank sync** — **not planned** (product out of scope)

---

### 4. Bottleneck issues

⚠️ **Promotion gate** — biggest process blocker. Lab features stay sandbox until you approve promotion in chat after `/ali` testing; agents must not mark `promoted` or wire into `/app` alone.  
⚠️ **Outreach ops** — cold sends depend on verified Resend mailboxes and manual CSV workflow; no integrated CRM or reply tracking yet.  
⚠️ **Gmail rendering risk** — heavy email iteration this week; still needs validation on real inboxes (especially Gmail iOS) after live sends.  
⚠️ **Beta feedback loop** — outreach assets are polished but need real Geneva SME responses to validate conversion and onboarding friction.  
⚠️ **Open Banking out of scope** — no live bank sync; Personal depends on manual file upload + Drive backup.  
⚠️ **Cloud sync / rules mismatch risk** — soft UX shipped, but owners/invitees may still get local-only Budget if production rules don’t match expectations.  
⚠️ **Pre-existing TS / Prettier debt** — noisy baseline checks; not treated as this week’s regressions.

**Next week focus:** live beta sends → phone inbox QA → decide Ali lab promotions → Invoice Maker sprint → verify Firestore rules on production.

---

*WhatsApp copy-paste format:* [`docs/weekly-updates/2026-08-28-whatsapp.md`](./weekly-updates/2026-08-28-whatsapp.md)
