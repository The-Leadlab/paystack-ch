# Dashboard CSV multi-row verification — super prompt

## Problem

Uploading a business CSV on `/app` (Dashboard Documents) sent the file through Gemini like a PDF invoice. The model collapsed large sheets to **one** issuer / amount / line item (first row). Verification Center still showed a broken PDF/image preview and “Open PDF” for CSV.

## Goals

1. **Parse every CSV data row** into ledger line items (income + expense + payment metadata).
2. Post as **Bank Statement** so `postLedgerFromFinancialData` creates one ledger entry per row.
3. **Verification Center**: CSV-native left panel (spreadsheet sample + income/expense counts), no PDF preview; “Open CSV” instead of “Open PDF”.
4. Skip Gemini + Swiss-account classify for CSV (fast, deterministic).

## Implementation

| Piece | Path |
|--------|------|
| CSV detect helper | `client/src/cafe/lib/businessDocumentFile.ts` → `isCsvDocumentFile` |
| Deterministic parser | `client/src/cafe/lib/businessCsvImport.ts` → `parseBusinessCsvFile` |
| Short-circuit AI | `analyzeFinancialDocument` in `geminiService.ts` |
| Verify UI | `NeuralLog` + VerificationHub labels in `DocumentProcessor.tsx` |
| i18n | `dpOpenCsv`, `dpCsvPreviewTitle`, … in `dashboardTranslations.ts` |

### Expected columns (flexible aliases)

`date`, `flow` (`income`/`expense`), `description`, `supplier`, `category`, `gross_chf`/`amount`/`net_chf`, `vat_chf`, `payment_method`, `invoice_number`, `currency`, `notes`. Also supports `debit`/`credit` bank layouts.

Without `flow`, heuristics use signed amounts, category, and description keywords.

### Fixture

Default test file (~100 rows, mixed income/expense):

```bash
node scripts/generate-dashboard-csv-fixture.cjs
# → fixtures/paystack-dashboard-test-100.csv
```

Larger stress file (optional):

```bash
CSV_FIXTURE_ROWS=2800 node scripts/generate-dashboard-csv-fixture.cjs
```

## Processing + reports UX

While CSV parse + Storage sidecar + ledger batch runs, the document stays **processing** (EN COURS). Dashboard income/expense totals update **once** after the batch commit (not row-by-row), so Reports / Revenue / Expenses stay readable.

Bank-statement lines post as normal income (SALES/RESERVATION) and expense rows dated from the CSV — same source Reports already use.

## Manual test

1. `pnpm dev` → `/app` → Documents / Dashboard upload.
2. Upload `fixtures/paystack-dashboard-test-100.csv` (generate with the script above).
3. Row stays **EN COURS / processing** until ledger batch finishes — dashboard totals should jump once, not tick upward.
4. Verification Center left: CSV ledger preview (sample rows, IN/OUT), not a black “Document Preview”.
5. Buttons say **Open CSV**, not Open PDF.
6. Right: bank-statement totals + all imported line items.
7. Approve / Reports: income & expense rows match CSV dates and flows.

## Firestore 1 MiB limit (large CSV)

Saving thousands of `lineItems` inline exceeds Firestore’s **1,048,576 byte** document cap (typical for multi‑MB CSVs).

**Fix:** `client/src/cafe/lib/financialDataFirestorePayload.ts` + `DocumentContext`
- If payload is large / >150 lines → upload full `lineItems` JSON to Firebase Storage
- Firestore keeps header + ~40-line preview + `lineItemsUrl` / `lineItemsCount`
- React state keeps the full array; Verification Center hydrates from Storage when expanding
- Ledger resync hydrates before posting

CSV row notes are also kept short (no fixture padding) to reduce sidecar size.
