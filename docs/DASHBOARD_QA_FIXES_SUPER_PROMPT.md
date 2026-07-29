# Dashboard QA Fixes — Super Prompt

Product QA issues from screenshots (expenses bleed, budget inputs, profitability, VAT warnings, categories, insights).

Related: `docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md`, `docs/PERSONAL_TABS_LEDGER_SUPER_PROMPT.md`, `docs/REVENUE_HUB_SUPER_PROMPT.md`.

---

## Problems

1. **Personal → business bleed** — Expenses added on `/app/personal` appear in business Expenses. Personal ledger must stay IndexedDB-only; never write personal txs into restaurant `expenses`.
2. **Budget numbers won’t record** — Controlled inputs only commit on blur; Swiss/EU formats (`12,50`, `1'200`) parse as `NaN` and are discarded.
3. **Profitability ignores expenses** — COGS/margin use a narrow filter; most costs stay `OTHER` or get sector-dropped → margin ≈ 100%.
4. **No clear VAT warning** — Docs with 0 / non-Swiss VAT still show green **COMPLETED**. Need amber **Need action** until user confirms or corrects VAT.
5. **Expense categories** — AI fine categories collapse to `OTHER`. Only payroll string-matches. Supplier/bills should be the rule; OTHER the exception.
6. **Insights confuse** — Reconciliation should deep-link to items; WoW is wrong without daily data; cash-on-hand should support deposit logging + till advice. Prefer honesty over fake precision.

---

## Product rules

### A. Personal / business isolation
- Personal writes: `personalBudgetStore` / IndexedDB only.
- Business Expenses list: restaurant `FinanceContext` expenses only — exclude any personal-tagged rows if they ever leaked.
- Do not reintroduce `personalExpenseToFirestore` as the default personal write path.

### B. Budgeting
- Parse amounts with CHF-aware parser (comma decimal, apostrophe thousands).
- Commit on blur **and** Enter; keep draft visible while typing; show inline error on invalid.

### C. Profitability
- Period P&amp;L: revenue − **all** business expenses in range (SUPPLIERS + BILLS + PAYROLL + OTHER), not COGS-only.
- Sub-lines: Cost of goods (SUPPLIERS), Operating (BILLS+OTHER), Payroll (PAYROLL*), Margin = profit / revenue.
- Avg transaction stays revenue / income txn count.

### D. VAT need-action
- After AI: if VAT amount ≤ 0 **or** rate not in Swiss presets (0 / 2.6 / 8.1 ±ε) → status `needs_review` (pill: Need action).
- User must confirm “no VAT / rate OK” or edit rate/amount → then `completed`.
- Exemption: explicit `vatConfirmed: true` or user confirm action.

### E. Category mapping
- Map AI / detector fine categories → ledger enum:
  - food/beverage/supplies/inventory/aligro/… → `SUPPLIERS`
  - rent/utilities/insurance/telecom/subscription/… → `BILLS`
  - salary/payroll/payslip → `PAYROLL`
  - AHV/AVS/tax social → `PAYROLL_TAXES`
  - else → `OTHER` (exception)
- Issuer heuristics: known wholesalers → SUPPLIERS; café/bills keywords → BILLS.

### F. Insights
- Reconciliation: clickable → switch hub tab to reconciliation / highlight exception docs.
- WoW: if no daily/Z-reading density, emit “insufficient data — upload daily Z-readings or POS exports” instead of fake %.
- Cash on hand: allow log deposit (date, amount); advise till float from recent turnover; don’t invent cash from revenue × 0.15 without POS.

---

## Agent instructions

```
Apply docs/DASHBOARD_QA_FIXES_SUPER_PROMPT.md.

1. Stop personal expenses writing to business ledger; filter business Expenses UI.
2. Fix BudgetingPanel amount parse + commit.
3. Rebuild profitability to include all expenses.
4. VAT → needs_review + Need action pill + confirm flow.
5. mapAiExpenseCategoryToLedger + wire handleDocumentData/Updated.
6. Honest insights + recon deep-link + cash deposit UX.
7. EN/FR strings. Do not push unless asked. Do not promote /ali.
```

---

## File map

| Path | Role |
|------|------|
| `client/src/ali-lab/features/BudgetingPanel.tsx` | Budget inputs |
| `client/src/ali-lab/personal-plan/personalLedgerEntry.ts` | Stop Firestore mapping if still used for writes |
| `client/src/cafe/lib/revenueAnalytics.ts` | Profitability + insights |
| `client/src/cafe/components/POSManager.tsx` | Insights UI / cash deposits |
| `client/src/cafe/components/RestaurantDashboard.tsx` | Expense category + VAT status |
| `client/src/cafe/components/DocumentProcessor.tsx` | Need action pill |
| `client/src/cafe/lib/mapExpenseCategory.ts` | NEW mapping helper |
| `client/src/cafe/lib/vatReview.ts` | NEW VAT review helpers |
| `shared/swissVatRates.ts` | Rate validation |
| `client/src/cafe/i18n/dashboardTranslations.ts` | Labels |

---

## Acceptance

- [x] Personal grocery expense does **not** appear under business Expenses (bleed filter + IndexedDB isolation).
- [x] Budget field accepts `12,50` / `1200` and saves.
- [x] Profitability margin reflects all expenses (COGS + operating + payroll).
- [x] Doc with 0% / non-Swiss VAT shows **Need action** until confirmed.
- [x] Aligro / butcher / café invoices map to SUPPLIERS or BILLS via `mapAiExpenseCategoryToLedger`.
- [x] Insights: recon deep-link; WoW honest without daily data; cash deposit + till advice.
