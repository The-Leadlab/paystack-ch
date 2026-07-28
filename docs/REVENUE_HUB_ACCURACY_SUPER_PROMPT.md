# Revenue Hub Accuracy — Super Prompt

Use this when hardening the **Revenue** tab (`POSManager`) so overview, history, sectors, demo refresh, payment mix, and industry modules stay accurate and scannable.

Related: `docs/REVENUE_HUB_SUPER_PROMPT.md`, `docs/REVENUE_SECTOR_CATALOG_SUPER_PROMPT.md`, `docs/REVENUE_TABLE_LOAD_MORE_SUPER_PROMPT.md`.

---

## Problems (from product QA)

1. **Import history** scrolls to Daily Z-readings — not a real history of Revenue activity.
2. **Overview / KPIs / charts / payment mix** ignore sector selection — removing a sector does not change hub numbers.
3. **Refresh demo** deletes `[DEMO]` rows then re-seeds → UI flashes to **0** mid-flight.
4. **Industry modules** (stadium, hotel, fiduciary, restaurants, …) all render at once — too long; need **2 + Load more** (same pattern as breakdown / Z-readings).
5. Modules must stay **accurate to sector recipes** (`revenueSectors.ts`) and allow light **in-app modification** of match keywords (persisted locally).

---

## Product rules

### A. Revenue activity history

- Rename behavior: **Import history** opens / scrolls to a dedicated **Revenue activity history** panel (not Z-reading cards).
- Record entries for: Z-reading save, CSV import, demo load, demo refresh, (optional) sector catalog apply.
- Store in `localStorage` keyed per session/restaurant if possible, else global `paystack.revenue.activityHistory` (cap ~100 newest).
- Each row: timestamp, type, label/detail, optional amount summary.
- Show first **10** + Load more (reuse existing chip pattern).

### B. Sector-accurate overview

- When `activeSectors` is non-empty, hub math uses only rows matching **any** selected sector recipe (`matchSector` / keyword filter on income + expenses + Z where applicable).
- Surfaces that must update when sectors change: hero KPIs, trend, budget, cash/profit, recon, payment mix, AI insights, industry modules, (optionally) breakdown filtered the same way — **default: yes, filter breakdown too**.
- If no sectors selected → empty banner (existing) and zeroed / empty charts.
- Demo seed still tags multi-sector lines so toggling sectors visibly changes totals.

### C. Demo refresh

- While `demoLoading`, keep previous rendered snapshot **or** show a single loading overlay — never flash empty KPIs.
- Prefer: compute seeds → write new demo → then delete old `[DEMO]` (or delete+seed without yielding empty intermediate UI).
- Button stays disabled with spinner until finished.

### D. Industry modules UX

- Render **2** modules first; **Load more** reveals +2 (or remaining); **Show less** collapses to 2.
- Module KPIs/charts still from `computeSectorModule` recipes.
- Allow editing **keywords** for a sector (comma-separated) via small “Edit recipe” control; persist overrides in `localStorage` (`paystack.revenue.sectorKeywordOverrides`); merge over catalog defaults in `matchSector` / `filterRowsForSector`.

### E. Do not break

- Paystack branding / existing CSS tokens.
- Z-reading workspace + Connect data → upload scroll.
- Breakdown / Z-reading 10+Load more already shipped.

---

## Agent instructions (copy-paste)

```
Harden Revenue tab accuracy per docs/REVENUE_HUB_ACCURACY_SUPER_PROMPT.md.

1. Add Revenue activity history panel; wire rhImportHistory to it (not Z cards).
2. Filter hub analytics + breakdown by activeSectors recipes.
3. Fix refreshDemoData zero-flash (hold UI or reorder delete/seed).
4. Industry modules: show 2 + Load more / Show less.
5. Local keyword overrides for sector recipes; modules stay recipe-driven.
6. EN/FR strings in dashboardTranslations.ts.
7. Do not push unless the user asks.
```

---

## File map

| Path | Role |
|------|------|
| `client/src/cafe/lib/revenueActivityHistory.ts` | Activity log store |
| `client/src/cafe/lib/revenueSectors.ts` | Keyword overrides + multi-sector filter helper |
| `client/src/cafe/components/POSManager.tsx` | Wire history, sector filter, demo, module pagination |
| `client/src/cafe/components/RevenueIndustryModule.tsx` | Optional edit-recipe UI |
| `client/src/cafe/i18n/dashboardTranslations.ts` | New strings |
| `docs/REVENUE_HUB_ACCURACY_SUPER_PROMPT.md` | This prompt |

---

## Acceptance

- [x] Import history shows activity list; does not jump only to Z-readings.
- [x] Deselecting a sector changes overview KPIs / payment mix / modules.
- [x] Refresh demo never shows a blank/zero flash.
- [x] Only 2 industry modules visible initially; Load more reveals more.
- [x] Editing a sector’s keywords changes which rows match that module.
- [x] EN + FR labels present.
