# Personal Plan — UI/UX Audit Super Prompt

Use this when auditing or hardening the **Paystack.ch personal plan** (`/app/personal/*` and `/ali/*` after gate). Goal: every nav item, button, and link must do something sensible; data must flow through Firebase the same way as Business.

---

## Scope

| Surface | Base route | Auth |
|---------|------------|------|
| Production | `/app/personal/overview` | Firebase (same as `/app`) |
| Lab | `/ali/overview` | Ali lab password + optional Firebase |

**Modules:** Overview · Budget · Reports (forecast) · Savings (goals) · Investments · Bills

---

## UX audit checklist (agent)

### Navigation

- [ ] Sidebar: 6 distinct items (no duplicate Dashboard/Budget → same route)
- [ ] Logo → overview home for current surface
- [ ] Mobile: primary tabs + center **Add transaction** + **More** sheet (Reports, Investments, Business)
- [ ] Business ↔ Personal links work both ways
- [ ] Default redirects: `/app/personal` → `/app/personal/overview`, `/ali` → `/ali/overview`
- [ ] No links to raw `/docs/*.md` in production UI

### Transactions (shared ledger)

- [ ] **Add transaction** opens modal from sidebar, session bar, overview, mobile FAB
- [ ] Modal requires active session; clear error if none
- [ ] Saves to Firestore `income` / `expenses` — visible in Business
- [ ] Overview + Budget: edit/delete month transactions
- [ ] Bills **Log payment** pre-fills modal (BILLS, amount, name)

### Month & session

- [ ] Single month picker in header drives KPIs, budget rows, transaction list
- [ ] Session picker in session bar; auto-select first session when available
- [ ] KPI strip uses **month-scoped** household totals

### Per panel

| Panel | Must work |
|-------|-----------|
| **Overview** | KPI cards, quick links to all modules, recent ledger, add transaction |
| **Budget** | Edit budget numbers (Firestore persist), mode toggle persists, zero-based donut |
| **Goals** | Add/edit/delete goals, fund from surplus (month-scoped, no double-spend in session), New goal card scrolls to form |
| **Bills** | Add/edit/delete bills, log payment → transaction modal |
| **Forecast** | Start balance from household net; use ledger balance button works |
| **Investments** | Add/remove holdings, update price, allocation vs household balance |

### i18n

- [ ] Language switcher updates titles (use `useLabLanguage`, not hardcoded `"en"`)
- [ ] Overview + all panels registered in `labRegistryI18n.ts`

---

## Architecture (do not break)

```
FinanceContext + SessionContext  →  useLinkedLedger(month)
ali_lab_* collections          →  useAliLabPersist (budgets, goals, bills, holdings)
PersonalPlanContext            →  month, surface, openTransaction(prefill?)
PersonalPlanShell              →  provider, sidebar, session bar, modal
```

---

## Files to touch for UX fixes

```
client/src/ali-lab/personal-plan/
client/src/ali-lab/features/PersonalDashboardPanel.tsx
client/src/ali-lab/features/BudgetingPanel.tsx
client/src/ali-lab/features/GoalsPanel.tsx
client/src/ali-lab/features/BillRemindersPanel.tsx
client/src/ali-lab/i18n/labRegistryI18n.ts
client/src/pages/PersonalAppPage.tsx
client/src/pages/PlatformPage.tsx
client/src/pages/AliLabPage.tsx
```

---

## Verification

```bash
pnpm dev
# Production personal (signed in):
#   /app/personal/overview → add transaction → check /app
#   /app/personal/budgeting → edit budget → refresh
#   /app/personal/goals → add goal, fund from surplus
#   /app/personal/bill-reminders → log payment
# Lab:
#   /ali-gate → /ali/overview
```

Build: `pnpm build` must pass before push.

---

## Phase 2 completed (2026-07)

- Overview dashboard as home
- Fixed nav duplicates and broken doc links
- Transaction prefill from bills
- Goals menu (edit/delete), New goal card
- Budget mode persistence
- Mobile More sheet + FAB
- i18n for overview; sign-in redirects per surface
