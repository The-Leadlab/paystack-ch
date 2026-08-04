# Expenses Hub — Super Prompt

## Goal

Make `/app` **Expenses** a first-class hub that mirrors the Revenue page structure (toolbar, hero, interval KPIs, hub tabs, ledger, activity) and wires every number to live session-filtered business expenses from `FinanceContext`.

Keep Paystack **branding, colors, and fonts** (`ba-v3` tokens). Spend accents use red; do **not** clone Ledger’s light/serif theme.

Dashboard expense list / add modal stay unchanged. Z-reading / POS stay on Revenue only.

## Must work (live calculations)

| Panel | Live rule |
|-------|-----------|
| Spend today / period / week / YTD interval | Sum `filterBusinessExpenses` rows by date + optional category pill |
| WoW / vs prior % | This interval vs previous window of same length |
| Spend trend | Daily (or weekly) expense series for filter |
| Budget vs actual | Period spend vs trailing 3-month average spend |
| Category mix | Sum by BILLS / SUPPLIERS / PAYROLL / PAYROLL_TAXES / OTHER |
| Top vendors | Group by description in filter |
| Spend buckets | COGS (suppliers) · operating (bills+other) · payroll |
| P&L strip | Period income − expenses (`buildProfitability`) |
| Insights | Rule engine: WoW spike, over/under pace, category dominance, missing docs |
| Documents tab | Expense rows in range; open linked document → Documents tab |
| Add expense | Inline form → `addExpense` on current session |
| Load / Refresh demo | Seeds ~30d mixed expenses (`[DEMO]`) |

## Page structure (exact order)

1. Toolbar — category pills · Add expense · Open documents
2. Secondary — Activity history · Refresh demo · Load demo
3. Hero — Spend at a glance · Period total
4. Empty banner (no data) with Load demo CTA
5. Interval bar + 4 KPIs — Period · vs prior · Daily avg · Entries
6. Hub tabs — Trend · Categories · Documents
7. Trend: spend chart + budget panel + buckets / P&L / insights
8. Categories: mix chart + top vendors
9. Documents: expense table with category edit + Open
10. Inline add-expense form (when opened)
11. Expenses ledger (`RevenueLedgerTable` `expensesOnly`)
12. Activity history

## Nav

- Sidebar + mobile: **Expenses** after Revenue
- Deep link: `?tab=expenses`
- Gated like Revenue (`showRevenueTab` / `allCoreModules`)

## Do / don't

- **Do** use session-filtered expenses + `filterBusinessExpenses` (no personal bleed).
- **Do** keep buttons functional (scroll/nav/seed/filter).
- **Don't** add Z-reading / bank sync / Open Banking.
- **Don't** remove Dashboard expense section in this pass.
- **Don't** push without approval.

## Key files

| Path | Role |
|------|------|
| `docs/EXPENSES_HUB_SUPER_PROMPT.md` | This prompt |
| `client/src/cafe/components/ExpensesManager.tsx` | Expenses hub UI |
| `client/src/cafe/lib/expenseAnalytics.ts` | Live math + demo seeds |
| `client/src/cafe/lib/expenseActivityHistory.ts` | Browser activity log |
| `client/src/cafe/components/RevenueLedgerTable.tsx` | `expensesOnly` ledger |
| `client/src/cafe/components/BusinessSidebarNav.tsx` | `expenses` tab id |
| `client/src/cafe/components/RestaurantDashboard.tsx` | Nav + mount |
| `client/src/cafe/businessApp.css` | `.ba-expense-*` accents |
| `client/src/cafe/i18n/dashboardTranslations.ts` | EN/FR `eh*` keys |
