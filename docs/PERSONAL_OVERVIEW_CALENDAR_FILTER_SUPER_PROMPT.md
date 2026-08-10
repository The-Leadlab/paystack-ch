# Personal Overview — dedupe KPIs + calendar period filter

## Problem

On `/personal/overview`, Income / Expenses / Savings / Savings rate appear **twice**:

1. Shell `PersonalPlanKpiStrip` (5 cards)
2. Overview `PersonalDashboardPanel` (4 cards)

Header also shows the month twice (`type="month"` + text label).

## Goal

- Keep **one** KPI strip only.
- Add a clear **calendar period filter** so KPIs, statement imports list context, and “Transactions this month” follow the selected month/date period.
- Remove redundant month text in the header.

## Implementation

1. Delete the KPI grid from `PersonalDashboardPanel.tsx`.
2. Add `PersonalPeriodFilter` (prev / next month + `input type="month"`) wired to `usePersonalPlan().month` / `setMonth`.
3. Place the filter in the header (single control) and optionally a compact “Showing: Month YYYY” line above the KPI strip — no duplicate picker.
4. Ledger already filters by `month` via `usePersonalBudgetLedger(month)` — no change to business Revenue.

## Out of scope

Open Banking; day-range multi-month charts; promoting Ali lab.
