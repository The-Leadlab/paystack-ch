# Personal Tabs — Same Ledger as Overview — Super Prompt

Use this when fixing personal nav tabs so **Budget / Reports / Savings / Investments / Bills** use the **same personal document ledger** as Overview — not Business `/app` Firebase finances.

Related:
- `docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md`
- `docs/PERSONAL_AI_DOCS_SAVINGS_SUPER_PROMPT.md`

---

## Problem

Overview already reads `personalBudgetStore` (IndexedDB from statement upload / personal add-tx).

Other personal tabs still call `useAliLabLedger` → `useLinkedLedger` → restaurant session income/expenses from `/app`. Uploaded personal documents never appear there.

## Rule

On `/app/personal/*` and `/ali/*` personal-plan surfaces, **all money math** for nav tabs must come from `usePersonalBudgetLedger` / `personalBudgetStore`.

Do **not** use Business session picker, Firebase restaurant ledger, or Revenue totals for these tabs.

| Tab | Feature id | Data source |
|-----|------------|-------------|
| Overview | overview | personalBudgetStore |
| Budget | budgeting | personalBudgetStore (spent/received by personal category) |
| Reports | forecasting | personalBudgetStore → cash forecast |
| Savings | goals | personal month surplus |
| Investments | investments | portfolio vs personal balance |
| Bills | bill-reminders | paid match against personal expenses |

Lab-only panels (automation, shared access, etc.) may keep LinkedLedger unless they sit inside PersonalPlanShell money UI.

## Agent instructions (copy-paste)

```
Align every personal nav tab with Overview’s personal ledger.

Rules:
1. Write/follow docs/PERSONAL_TABS_LEDGER_SUPER_PROMPT.md.
2. Expand usePersonalBudgetLedger to expose monthRows + Income/Expense adapters for forecast helpers.
3. Replace useAliLabLedger / useLinkedLedger in: BudgetingPanel, ForecastingPanel, GoalsPanel, InvestmentsPanel, BillRemindersPanel, PersonalPlanHeader, PersonalPlanShell, PersonalSessionBar.
4. Budget spent/received must use PersonalBudgetTx.expenseCat / incomeCat (not classifyPersonalExpense on business categories).
5. Remove “linked to business ledger / Firebase session” chrome; show personal-budget messaging instead.
6. Keep restaurant /app Revenue and Documents unchanged.
7. EN/FR strings if you add banner copy. Do not push/commit unless asked.
```

## Acceptance

- [ ] Upload a statement on Overview → Budget category spend updates for the same month.
- [ ] Goals surplus matches Overview savings for that month.
- [ ] Reports forecast uses personal inflows/outflows only.
- [ ] Bills “paid in ledger” matches personal expense descriptions.
- [ ] No Business session selector required for personal money tabs.
