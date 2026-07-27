# Revenue Hub — Super Prompt (Screenshot parity + live app)

Reference screenshots: Ledger “tailored-revenue-hub” (toolbar, hero, KPIs, cash/profit/recon, payments, AI insights, industry modules).

## Goal

Make `/app` **Revenue** look **structurally identical** to the screenshots (sections, buttons, panels, empty states) and **fully wired to Paystack live data** so every number recalculates from Finance + POS + session context.

Keep Paystack **branding, colors, and fonts** (`ba-v3` tokens). Do **not** clone Ledger’s light/serif theme.

## Must work (live calculations)

| Panel | Live rule |
|-------|-----------|
| Revenue today / YTD / week / month | Sum `FinanceContext.income` for current session(s) by date |
| WoW % | This week vs previous 7 days |
| Revenue trend | Daily income last 30 days |
| Budget vs actual | Month income vs trailing 3-month average |
| Cash position | From Z-readings: card→in bank, cash→on hand; RESERVATION income→incoming; recent undeposited cash→pending |
| Profitability MTD | Month income − month expenses (SUPPLIERS+OTHER as COGS proxy); margin %; avg ticket |
| Reconciliation | Day-level POS gross vs ledger; missing Z; duplicate Z; open badge count |
| Payment mix MTD | Month Z cash/card/other; empty state if no POS |
| AI insights | Rule engine from live variance, WoW, budget, invoices, recon |
| Industry modules | Income description keywords → sector KPIs + bar breakdowns |
| Upload Z reading | Saves POS **and** syncs a matching SALES income row so hub KPIs update |
| Load / Refresh demo | Seeds ~30d income + Z + supplier expenses (`[DEMO]`); enables all sectors |

## Page structure (exact order)

1. Toolbar — sector pills · Connect data · Change sectors · Sector log · **Upload Z reading**
2. Secondary — Import history · Refresh demo · Load demo data
3. Hero — Revenue overview / Today at a glance · Revenue today
4. Empty banner (no data) with Load demo CTA
5. KPI cards — Yesterday · This week (+WoW) · This month · YTD
6. Revenue trend (wide) + Budget vs actual
7. Cash position · Profitability (MTD) · Reconciliation
8. Payment method (MTD) · AI insights
9. Industry module blocks (one per enabled sector)
10. Income ledger · Z-reading workspace · Z history

## Do / don't

- **Do** use session-filtered income, expenses, POS.
- **Do** keep buttons functional (scroll/nav/seed/toggle).
- **Don't** invent fake bank sync; pending deposits are derived heuristics from POS cash.
- **Don't** change global branding or push without approval.

## Key files

| Path | Role |
|------|------|
| `docs/REVENUE_HUB_SUPER_PROMPT.md` | This prompt |
| `client/src/cafe/components/POSManager.tsx` | Revenue page |
| `client/src/cafe/components/RevenueIndustryModule.tsx` | Sector blocks |
| `client/src/cafe/lib/revenueAnalytics.ts` | All live math |
| `client/src/cafe/lib/revenueSectors.ts` | Sector KPIs |
| `client/src/cafe/lib/revenueDemoData.ts` | Demo seed |
| `client/src/cafe/lib/revenueImport.ts` | CSV import |
| `client/src/cafe/businessApp.css` | `.ba-revenue-*` layout |
| `client/src/cafe/i18n/dashboardTranslations.ts` | EN/FR |
