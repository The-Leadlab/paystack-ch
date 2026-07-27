# Revenue tables — first 10 + Load more — Super Prompt

Use this when paginating long lists on the **Revenue** tab so the UI stays scannable.

## Goal

On Revenue:

1. **Revenue breakdown** table (`RevenueLedgerTable`, income-only) — show **10** rows first, then **Load more**.
2. **Daily Z-readings** list in `POSManager` — show **10** cards first, then **Load more**.

Do not dump hundreds of demo/live rows into the first viewport.

## Rules

- Default page size: **10**.
- Each click on Load more reveals **+10** more items (or remaining count).
- Show remaining count in the button when helpful (e.g. “Load more (24)”).
- Optional “Show less” collapsing back to 10 is nice but not required.
- Reset visible count when the underlying data set identity/length changes meaningfully.
- EN + FR strings in `dashboardTranslations.ts` (and LanguageContext if keys are duplicated there).
- Keep Reports PDF/export logic unchanged — pagination is UI-only.

## Files

| Path | Change |
|------|--------|
| `client/src/cafe/components/RevenueLedgerTable.tsx` | Slice + Load more |
| `client/src/cafe/components/POSManager.tsx` | Z-reading grid slice + Load more |
| `client/src/cafe/i18n/dashboardTranslations.ts` | `rhLoadMore` / `rhShowLess` |
| `docs/REVENUE_TABLE_LOAD_MORE_SUPER_PROMPT.md` | This prompt |

## Acceptance

- [ ] With >10 income rows, breakdown shows 10 + Load more.
- [ ] With >10 Z-readings, history shows 10 + Load more.
- [ ] Load more reveals additional items without leaving the page.
- [ ] Empty states unchanged.
