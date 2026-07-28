# Revenue Trend + Custom Categories — Super Prompt

Use this when fixing the **Revenue trend** chart so dates/amounts stay connected to the hub, and when adding **manual custom categories** (sectors) without AI.

Related: `docs/REVENUE_HUB_ACCURACY_SUPER_PROMPT.md`, `docs/REVENUE_SECTOR_CATALOG_SUPER_PROMPT.md`.

---

## Problems (from product QA)

1. **Revenue trend** X-axis shows sparse odd dates (e.g. 2 Jul, 4 Jul, 6 Jul, 8 Jul) that feel disconnected from the dashboard — chart was a rolling **30 days** while the header showed **this month** MTD total.
2. Trend amounts must use the same **sector-filtered** income as KPIs (already wired) and the **same calendar window** as “this month”.
3. Built-in sector **recipes** need clearer, non-overlapping keywords so toggling sectors stays accurate.
4. Users need **custom categories** they define themselves (name + keywords) — **no AI fill**; matching stays keyword/recipe based like built-ins.

---

## Product rules

### A. Revenue trend = month-to-date

- Build one point per calendar day from **month start → today** (not rolling 30).
- Header amount = sum of those points (= `revMonth` / sector-filtered MTD).
- Tooltip shows the **full date** + CHF amount.
- X-axis: controlled ticks (~5–7 labels), never a misleading every-other-day scatter.
- Optional range caption under the title (e.g. `1 Jul – 28 Jul 2026`).

### B. Categories / sectors accuracy

- Tighten catalog keywords so demo lines and real descriptions map to one primary sector where possible.
- Keep keyword overrides + Edit recipe.
- Hub filter remains `rowMatchesAnySector` on active set.

### C. Custom categories (manual only)

- User can **Add custom category**: name, optional icon, comma-separated keywords.
- Persist in `localStorage` (`paystack.revenue.customSectors`).
- Appear in sector picker + toolbar pills; toggle like built-ins.
- Active list may mix built-in ids + `custom_*` ids.
- Modules use `kpiMode: 'general'` (or equivalent) with the custom display name — **no Gemini/AI** to invent categories or keywords.
- Allow edit keywords / delete custom category.

### D. Do not break

- Sector-filtered overview, activity history, demo hold, module Load more.
- Paystack branding / EN+FR.

---

## Agent instructions (copy-paste)

```
Apply docs/REVENUE_TREND_CATEGORIES_SUPER_PROMPT.md.

1. Replace rolling 30-day trend with month-to-date daily series; align header + tooltip + ticks.
2. Tighten sector keyword recipes for fewer overlaps.
3. Add manual custom categories (localStorage); wire picker, filter, modules; no AI.
4. EN/FR strings.
5. Commit and push when the user asks (this request includes push).
```

---

## File map

| Path | Role |
|------|------|
| `client/src/cafe/lib/revenueAnalytics.ts` | `trendMonthToDate` |
| `client/src/cafe/lib/revenueSectors.ts` | Custom sectors store + recipe tweaks |
| `client/src/cafe/components/POSManager.tsx` | Chart + custom category UI |
| `client/src/cafe/components/RevenueIndustryModule.tsx` | Display custom titles |
| `client/src/cafe/i18n/dashboardTranslations.ts` | Strings |
| `docs/REVENUE_TREND_CATEGORIES_SUPER_PROMPT.md` | This prompt |

---

## Acceptance

- [x] Trend days are 1…today of current month; amounts sum to MTD KPI.
- [x] Axis/tooltip dates look correct and match ledger dates.
- [x] User can add/edit/delete a custom category with keywords (no AI).
- [x] Custom category toggles filter hub totals like built-ins.
- [x] EN + FR present; pushed when requested.
