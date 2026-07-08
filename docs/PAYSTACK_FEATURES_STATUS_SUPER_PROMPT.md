# Paystack.ch — Features Status Super Prompt

Use this document after reading **Budgeting App Features Comparison in Switzerland** (BudgetCH, YNAB, Buxfer, BlueBudget). It maps competitor capabilities to **Paystack.ch** with implementation status for product, sales, and engineering.

**Generated:** 2026-07-07 · **Sources:** competitor PDF, `featureRegistry.ts`, `/app`, `/app/personal`, `/ali` lab.

---

## Status legend

| Badge | Meaning |
|-------|---------|
| **Implemented** | Live in production `/app` or `/app/personal` |
| **In progress** | Lab-ready (`/ali`), partial, or actively building next |
| **Pending** | Roadmap — not started |
| **Out of scope** | Explicit product decision (do not implement without approval) |

---

## Paystack positioning vs Swiss budgeting apps

Paystack.ch is **not a bank-sync budgeting app**. It is a **Swiss hospitality & business finance platform** with:

- **Document upload + Gemini AI** (invoices, receipts, payslips) → ledger
- **Business dashboard** (`/app`) — sessions, VAT, payroll, reports
- **Personal / household finances** (`/app/personal`) — budget vs actual, goals, bills, forecast
- **CHF-first**, Swiss TVA exports, plan comptable CH account codes

Competitor **bank synchronization / bLink / CSV import** is **out of scope** (`ALI_LAB_EXCLUDED_FEATURE_IDS`: `bank-sync`).

---

## Feature matrix (competitor categories → Paystack)

| Feature category | BudgetCH | YNAB | Buxfer | BlueBudget | Paystack.ch | Status |
|------------------|----------|------|--------|------------|-------------|--------|
| Cost | Free | Paid | Freemium | Free/Premium | Starter / Business / Unlimited (Stripe) | **Implemented** |
| Bank sync | No | Limited CH | Major CH banks | bLink | Document AI + manual entry | **Out of scope** (bank API) |
| Manual entry | Yes | Yes | Yes | Yes | Income/expense + personal modal | **Implemented** |
| AI document import | No | No | No | No | Invoices, receipts, payslips | **Implemented** |
| Budget vs actual | Yes | Yes (zero-based) | Yes | Auto + traditional | Household categories + zero-based mode | **Implemented** (`/app/personal/budgeting`) |
| Zero-based budgeting | No | Yes | Flexible | Partial | Toggle + allocation donut | **Implemented** |
| Weekly/monthly/yearly views | Yes | Yes | Yes | Daily summary | Month picker, sessions, reports | **Implemented** |
| Goal tracking | Basic | Advanced | Yes | Yes | Savings/debt goals + surplus fund | **Implemented** (`/app/personal/goals`) |
| Bill reminders | No | No | Yes | Yes (Serafe, etc.) | Due dates, overdue, log payment | **Implemented** (`/app/personal/bills`) |
| Forecasting / cash flow | No | Loan calc | Yes | No | 90-day projection from ledger | **Implemented** (`/app/personal/reports`) |
| Investment tracking | No | No | Yes | No | Holdings, P/L, allocation | **Implemented** (`/app/personal/investments`) |
| Shared budgets / family | Yes | YNAB Together | Access control | FairSplit | Members + FairSplit settlements | **In progress** (`/ali/shared-access`, lab ready) |
| Automation rules | No | Templates | Yes | Auto categories | Keyword → category rules | **In progress** (`/ali/automation-rules`, lab ready) |
| Offline capture | No | Yes | No | No | Offline queue prototype | **In progress** (`/ali/offline`, lab ready) |
| Multi-currency | No | Yes | Yes | — | CHF primary; export currency label | **Pending** (full multi-currency ledger) |
| Excel export | Paid add-on | Yes | Yes | — | Document + report Excel export | **Implemented** |
| PDF reports | — | Yes | Yes | — | Reports + Swiss TVA PDF | **Implemented** (Business plan) |
| Swiss TVA / VAT | — | — | — | — | Forms, CSV/PDF export | **Implemented** |
| Swiss payroll split | — | — | — | — | Net/gross, AVS/LPP/impôt | **Implemented** |
| DE / FR / IT i18n | Yes | EN | EN | DE | EN + FR (app); DE/IT (personal lab) | **In progress** (merge DE/IT to `/app`) |
| Swiss cost-of-living guidelines | Yes | No | No | Local bills | — | **Pending** |
| Loan calculator | No | Yes | — | — | — | **Pending** |
| Retirement planner | No | No | Yes | — | — | **Pending** |
| Auto budget from history | No | No | No | Yes | AI categorization only | **Pending** (auto budget suggestions) |
| Push notifications (bills) | No | No | Yes | Yes | — | **Pending** |
| **Create your own invoice** | No | No | No | No | Templates, numbering, recurring | **In progress** (next release) |
| POS / Z-reading | No | No | No | No | POS module (partial) | **In progress** |
| Plan test sandbox (internal) | — | — | — | — | Joshua plan switcher | **Implemented** |

---

## Paystack modules — detailed status

### Business platform (`/app`) — **Implemented**

- Firebase auth, email verification, Stripe subscriptions (Starter / Business / Unlimited)
- Sessions, income & expense ledger, drag-and-drop income ↔ expense convert
- Document processor (batch upload, Gemini AI, Swiss account codes)
- Swiss payroll on payslips, VAT received/paid
- Reports: CSV/PDF, Swiss TVA by month/year (Business+)
- Billing & plan panel, upgrade prompt at document cap
- Employee slots (plan-gated), POS readings (partial)

### Personal finances (`/app/personal`) — **Implemented**

- Overview hub, shared Firebase ledger with Business
- Budgeting (traditional + zero-based), bill reminders, goals, forecasting, investments
- Add/edit/delete transactions, session picker, month KPIs
- Linked from Business sidebar

### Ali feature lab (`/ali`) — **In progress** (test before promote)

| Feature ID | Status in lab | Production |
|------------|---------------|------------|
| overview | ready | **Implemented** (`/app/personal/overview`) |
| budgeting | ready | **Implemented** |
| bill-reminders | ready | **Implemented** |
| goals | ready | **Implemented** |
| forecasting | ready | **Implemented** |
| investments | ready | **Implemented** |
| shared-access | ready | **Pending** promote |
| automation-rules | ready | **Pending** promote |
| offline | ready | **Pending** promote |
| de-it-i18n | ready | **In progress** |
| bank-sync | excluded | **Out of scope** |

### Roadmap — **Pending** / **In progress**

| Item | Phase | Status |
|------|-------|--------|
| **Create your own invoice** (templates, numbering, recurring) | Phase 3 | **In progress — next** |
| Inventory (FIFO/LIFO) | Phase 2 | **Pending** |
| Employee management (full) | Phase 2 | **Pending** |
| Supplier management | Phase 2 | **Pending** |
| Client & project management | Phase 3 | **Pending** |
| Mobile apps | Phase 3 | **Pending** |
| Multi-entity / enterprise | Phase 4 | **Pending** |

---

## Agent instructions

When implementing a competitor feature from the Swiss PDF:

1. Check this matrix — do not duplicate **out of scope** bank sync.
2. Prototype in `/ali` first; update `featureRegistry.ts` status.
3. Mark **Implemented** only after wired to `/app` or `/app/personal` and user approves promotion.
4. Update `docs/PAYSTACK_FEATURES_COMPARISON_CH.html` and regenerate PDF after major releases.

**PDF artifact:** `docs/PAYSTACK_FEATURES_COMPARISON_CH.pdf` (from HTML via print or build script).

---

## Verification URLs (local)

```text
pnpm dev
/app                          — Business
/app/personal/overview        — Personal
/ali-gate → /ali/budgeting    — Lab sandbox
```
