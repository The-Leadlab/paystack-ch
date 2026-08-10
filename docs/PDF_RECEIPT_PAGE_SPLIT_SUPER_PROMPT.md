# PDF receipt page split — Super Prompt

## Problem

Files like **Ticket février.pdf** are multi-page scanned sheets (POS tickets / receipts), often with little or no extractable text. Sending the whole PDF to Gemini under-extracts tickets and also hits Firebase Storage retry limits on large re-downloads (`storage/retry-limit-exceeded` → `Failed to fetch`).

## Goals

1. Detect multi-page **ticket / receipt** PDFs.
2. Rasterize **each page** to a JPEG (or PNG) client-side.
3. Run the existing AI pipeline **one image at a time**.
4. Merge results into one parent document with `subDocuments[]` (one entry per page/receipt).
5. Harden Storage re-download so large PDFs can still be retried after refresh.

## Approach

| Step | Detail |
|------|--------|
| Detect | `pageCount >= 2` + name/hint matches ticket/receipt/z2/caisse (or `forcePdfPageSplit`) |
| Render | `pdfjs-dist` → canvas → JPEG `File` per page |
| Analyze | `analyzeFinancialDocument` per page with `skipPdfPageSplit: true` |
| Merge | Build `subDocuments` + rollup totals via existing normalize helpers |
| Storage | Better retries in `downloadDocumentFile`; page images are small uploads |

## Rules

1. Do **not** page-split payslips.
2. True multi-**invoice** binders can keep the full-PDF deep path; ticket sheets prefer page-split.
3. Prevent recursion with `skipPdfPageSplit`.
4. Preserve ledger behavior: one row per `subDocument`.
5. Out of scope: server-side Poppler, Open Banking.

## Acceptance

- [x] Ticket-style multi-page PDF → N page JPEGs analyzed separately → N invoices/receipts in Verification
- [x] Storage download retry survives transient `retry-limit-exceeded` more often (`getBlob` → `getBytes` → fresh URL → fetch, 5 attempts)
- [x] Single-page PDFs / photos unchanged
- [x] Payslips not page-split
- [x] Local Cache API backup after download so refresh/retry does not re-hit Storage for the whole PDF

## Related errors (Ticket février test)

| Console noise | Meaning |
|---------------|---------|
| `@firebase/auth … Pending promise was never set` | Stale popup/redirect Auth event; cleared via `getRedirectResult` on init |
| Stuck **EN COURS** with only `Processing:` log | PDF.js worker URL 404 in production (`new URL('pdfjs-dist/…')` not rewritten by Vite) — fixed with `?url` import + timeouts |
| `storage/retry-limit-exceeded` → `Failed to fetch` | Large PDF re-download timed out — mitigated by page-split + download hardening + Cache API |

## Sample

`Ticket_fevrier__3a42.pdf` — 5 A4 scanned pages (~3.5 MB), no text layer.
