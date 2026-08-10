# Multi-page invoice reader — Super Prompt

## Problem

Finance testers uploading PDFs with **many invoices bound together** (or multi-page Swiss delivery notes) saw under-detection: only the first 1–2 invoices, and product tables collapsed to a single total row.

## Goals

1. Read **every page** of PDF binders — never stop after the first invoice/page.
2. One `subDocuments[]` entry per **distinct invoice** (issuer / invoice number / dated block), with `pageRange` covering late pages.
3. Extract **product line items** (qty / unitPrice / amount) into nested `subDocuments[i].lineItems` and top-level product lists for Verification.
4. Admin can enable **`deepPdfInvoiceBeta`** per user so a tester (e.g. Michael) always takes the deep path.

## Approach

Always-on heuristic harden in `client/src/cafe/services/geminiService.ts` + optional force flag:

| Pass | Role |
|------|------|
| 1 | Core extract (full PDF → Gemini) |
| 2 | Exhaustive multi-invoice (when heuristics or beta) |
| 3 | Product line recovery (when products missing or beta) |

No pdf.js / page rasterization — full file bytes to Gemini (inline or Files API).

## Rules

1. Payslips skip exhaustive + product deep passes.
2. Items ≠ invoices: never promote product rows into `subDocuments`.
3. Prefer exhaustive merge when more invoices, better page coverage, or beta forced.
4. If `detectedInvoiceCount > extracted`, retry exhaustive once with a “you missed N” hint.
5. Multi-invoice binders with empty nested products → run product pass and nest onto subDocuments.
6. `forceDeepPdfReads: true` (from `users.deepPdfInvoiceBeta`) always runs passes 2–3 for non-payslip PDFs.

## Admin / ops

- Field: `users/{uid}.deepPdfInvoiceBeta: boolean`
- UI: Admin → Users → **Deep PDF invoice beta**
- After enable: user re-uploads the multi-invoice PDF.

## Related

- `docs/LINE_ITEM_DETECTION_SUPER_PROMPT.md`
- `docs/VERIFICATION_PER_ITEM_SUPER_PROMPT.md`

## Acceptance

- [ ] Large multi-invoice PDF → N distinct invoices (not 1–2), page ranges cover late pages
- [ ] Feldschlösschen-style delivery note → many product `lineItems` in per-item UI
- [ ] Admin can toggle Deep PDF invoice beta for a user
- [ ] Payslips still skip deep passes
- [ ] Ledger still posts one row per true `subDocument`
