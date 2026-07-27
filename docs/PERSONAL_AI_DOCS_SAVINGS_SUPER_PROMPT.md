# Personal AI Documents + Savings Coach — Super Prompt

Use this when implementing **automatic AI analysis** of personal bank/finance documents and **AI savings advice** (how to save + how much to save) on `/app/personal` and `/ali` overview.

Related: `docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md` (ledger isolation). Do not route personal docs through restaurant Revenue.

---

## Product goals

1. **Auto-analyze** — On upload (CSV/PDF), AI runs immediately (no manual “analyze” step).
2. **Auto-fill** — Date, amount, description, income/expense kind, and category are filled before commit.
3. **Auto-commit** — Valid rows are written to the **personal IndexedDB ledger** automatically (same spirit as Business Documents → ledger). User can edit/delete in the month list afterward.
4. **AI savings coach** — After data exists for the month, show suggestions:
   - **How much to save** (CHF target + % of income)
   - **How to save** (concrete tips tied to spending categories, with estimated monthly CHF impact)

Business Documents tab already auto-analyzes invoices with Gemini; this prompt is for the **personal** surface unless the user explicitly asks to change Business Documents.

---

## Agent instructions (copy-paste)

```
Implement Personal AI Documents + Savings Coach on Paystack personal surfaces.

Rules:
1. Follow docs/PERSONAL_AI_DOCS_SAVINGS_SUPER_PROMPT.md.
2. Keep personal data in personalBudgetStore (IndexedDB) — never revenueAnalytics / Z-reading.
3. On statement upload: parse → AI refine categories when signed in → auto-commit selected rows → refresh KPIs.
4. Add PersonalSavingsCoach: Gemini JSON advice (targetSaveChf, targetSavePct, tips[]); heuristic fallback if AI unavailable.
5. Auto-refresh coach when personal month totals change (after import / add / delete).
6. EN + FR strings in labStrings.ts. Match personal-plan GlassCard styling.
7. Do not implement Open Banking / bank-sync. Do not push/commit unless asked.
```

---

## File map

| Path | Role |
|------|------|
| `client/src/ali-lab/lib/personalAiAssist.ts` | AI category refine + savings advice |
| `client/src/ali-lab/personal-plan/components/PersonalStatementUpload.tsx` | Auto analyze/fill/commit UX |
| `client/src/ali-lab/personal-plan/components/PersonalSavingsCoach.tsx` | How much / how to save UI |
| `client/src/ali-lab/features/PersonalDashboardPanel.tsx` | Wire coach + upload |

---

## Acceptance

- [ ] Upload CSV/PDF → rows appear in personal ledger without a separate confirm click (status message shown).
- [ ] Categories/kinds filled (AI when signed in; keywords as fallback).
- [ ] Overview shows “How much to save” + actionable “How to save” tips.
- [ ] Coach updates after import; restaurant Revenue unchanged.
- [ ] Offline / no Gemini → heuristic save target still shown.
