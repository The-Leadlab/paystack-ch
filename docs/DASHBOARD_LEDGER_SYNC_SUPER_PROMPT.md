# Super Prompt — Dashboard ledger sync & categories

Use this when fixing Paystack.ch `/app` dashboard income/expense vs documents.

## Goals

1. **Sync** — Every completed document must create matching income/expense ledger rows (one row per sub-invoice when a PDF has multiple invoices). Re-processing a document must replace old linked rows, not orphan or duplicate them.
2. **Precise categories** — Never default to OTHER when issuer/description/document type can map to BILLS, SUPPLIERS, PAYROLL, or PAYROLL_TAXES. AI must assign a specific category; keyword detection is a fallback before OTHER.
3. **Click → verification** — Clicking an income/expense row linked to a document opens the Documents tab verification center for that file.
4. **Edit after AI** — Users can change category (and income type) on ledger rows after AI assignment; saves to Firestore.

## Out of scope

- Do not auto-promote Ali lab features into `/app`.
- Do not invent bank sync / CSV import.

## Implementation notes

- Post ledger from `subDocuments[]` when length ≥ 1; otherwise post top-level amount once.
- Clear finances by `document_id` before re-posting on process and on update.
- Strengthen Gemini category rules + `mapAiExpenseCategoryToLedger` + `detectCategory` fallback.
- Wire edit UI (category select) and navigation already present on dashboard rows.
