# Personal statement AI import fix — Super Prompt

Related: `docs/PERSONAL_E2E_DRIVE_SUPER_PROMPT.md`, `docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md`.

## Problem (observed)

User uploaded `ali-bank-statement-2026-07.pdf` on `/personal/overview` while the month picker was **August 2026**. Console showed Firebase Storage upload (AI prep path) but Overview stayed at **CHF 0**. No visible AI fill / coach output.

Root causes to address:

1. **PDF AI can fail or return zero rows** (proxy/key/model/empty JSON) — import must not silently look like “nothing happened”.
2. **No client-side fallback** when Gemini returns no transactions from a text PDF.
3. **Month filter** — overview KPIs use the selected month; a July statement shows as zeros in August even after a successful import.
4. **KPI strip vs overview mismatch** — shell sometimes passed `month={undefined}` (all-time) while overview cards used August.
5. Sample PDF was sparse; improve fixture so August + July data exist and text is extractable without AI.

## Required behavior

1. Upload CSV/PDF/photo → analyze (AI) → categorize → **commit to personal ledger** (Firestore when signed in).
2. If PDF AI fails or returns no rows → **extract text from PDF** and parse Swiss-style ledger lines; still categorize with keyword + optional AI refine.
3. On successful import → **switch month picker** to the dominant statement month and refresh KPIs / recent ledger / savings coach.
4. Surface clear progress + toast/errors (analyzing / saving / failed).
5. Drive backup remains best-effort under `Personal/{date}/`.
6. Update fixtures PDF+CSV with richer July **and** August 2026 rows.

## Isolation

Never write personal statement rows into restaurant Revenue / business Documents ledger.

## Agent checklist

```
1. Write/update this super prompt.
2. Harden parsePersonalStatementFile (PDF AI + text fallback + clearer issues).
3. PersonalStatementUpload: toasts, setMonth after import, better errors.
4. PersonalPlanKpiStrip uses selected month from context (not undefined).
5. Regenerate fixtures with more data (Jul+Aug 2026).
6. Offline test + push.
```
