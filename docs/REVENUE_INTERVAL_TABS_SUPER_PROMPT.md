# Revenue Interval Tabs — Super Prompt

Use this when adding **interval filters** and a **Trend | Documents | Reconciliation** tab strip on the Revenue hub so KPIs, charts, and documents stay in sync.

Related: `docs/REVENUE_TREND_CATEGORIES_SUPER_PROMPT.md`, `docs/REVENUE_HUB_ACCURACY_SUPER_PROMPT.md`.

---

## Product decisions (confirmed)

1. **UI:** Tab strip under overview — **Trend | Documents | Reconciliation** (not only chips inside the chart).
2. **Documents:** Rows for the **active sector(s)** in the selected interval; **Open** jumps to the Documents tab and opens that document (`onNavigateToDocument`).
3. **KPIs:** Hero + KPI cards **follow the selected interval** (not fixed yesterday/week/month/YTD only).

---

## Interval presets

| Id | Range |
|----|--------|
| `all` | First → last date among sector-filtered income (document/ledger span) |
| `1m` | Start of current calendar month → today |
| `2m` | Start of month 1 month before current → today |
| `3m` | Start of month 2 months before → today |
| `6m` | Start of month 5 months before → today |
| `1y` | Start of month 11 months before → today |

Show caption: **First {date} → Last {date}** from the resolved range (and note when `all` uses real data bounds).

Default: `1m`.

---

## Surfaces that follow the interval (+ sectors)

- Hero period total
- KPI grid (period total, vs prior period, daily avg, entry/doc count)
- Trend chart (daily if ≤90 days, else weekly buckets)
- Budget / cash / profit / payment mix / insights (range-aware)
- Documents table
- Reconciliation panel (in its tab)
- Industry module row filter for the range

---

## Documents table

- Source: session income matching **active sectors** + **interval**; prefer rows with `document_id`.
- Columns: date, description/category, amount, source doc name (from `useDocuments`), Open action.
- Open → `onNavigateToDocument(doc)` → Documents tab.
- Rows without `document_id`: show entry but disable Open (or hint “Ledger only”).
- Paginate like breakdown (10 + Load more).

---

## Design

- Interval chips + tab strip use existing `ba-filter-chip` / gold active states — fits Paystack Revenue chrome.
- No purple/cream redesign; keep current tokens.

---

## Agent instructions

```
Apply docs/REVENUE_INTERVAL_TABS_SUPER_PROMPT.md.

1. Interval helpers + prior-period compare in revenueAnalytics.
2. POSManager: interval state, KPI rewrite, tabs Trend|Documents|Reconciliation.
3. Documents table + wire onNavigateToDocument from RestaurantDashboard.
4. EN/FR strings + CSS.
5. Do not push unless asked.
```

---

## File map

| Path | Role |
|------|------|
| `docs/REVENUE_INTERVAL_TABS_SUPER_PROMPT.md` | This prompt |
| `client/src/cafe/lib/revenueAnalytics.ts` | Range + trend-for-range |
| `client/src/cafe/components/POSManager.tsx` | UI wiring |
| `client/src/cafe/components/RestaurantDashboard.tsx` | Pass navigate-to-document |
| `client/src/cafe/i18n/dashboardTranslations.ts` | Strings |
| `client/src/cafe/businessApp.css` | Tab/interval chrome |

---

## Acceptance

- [x] Chips: All / 1M / 2M / 3M / 6M / 1Y change KPIs + trend.
- [x] Caption shows first→last dates for the filter.
- [x] Tabs switch Trend / Documents / Reconciliation.
- [x] Documents list respects sectors + interval; Open opens Documents tab.
- [x] EN + FR present.
