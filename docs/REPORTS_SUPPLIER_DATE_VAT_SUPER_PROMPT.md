# Super Prompt — Reports: suppliers, document dates, VAT

Swiss finance expert + developer fix for Reports / Invoicing & revenue ledger.

## Problems

1. **Repeated suppliers** — Top suppliers lists the same company many times (name variants, `| REF …` suffixes).
2. **Wrong dates** — Ledger rows show upload day (today) instead of the invoice/document date.
3. **VAT = 0** — TVA not copied into income/expense rows when only present in Swiss VAT table / net vs gross / vatRate.

## Rules

1. Canonicalize supplier names for aggregation (`canonicalizeSupplierName`) — strip refs, merge known aliases (Taligro/Aligro/Demaurex, Transgourmet, …).
2. Issuer field = company trade name only. Invoice/ref numbers go in `documentNumber`, never `Name | Ref 12345`.
3. Normalize all document dates to **YYYY-MM-DD** (`normalizeIsoDate` / `resolveDocumentDate`). Accept DD.MM.YYYY. Never default to today when a parseable date exists on the doc, sub-invoice, or line items.
4. Resolve VAT with `resolveDocumentVatAmount`: explicit `vatAmount` → receipt totals → `swissVatBreakdown` sum → gross − net → `vatRate × net` (or TTC formula).
5. Apply when **posting** ledger from AI and when **sanitizing** Gemini output; Reports UI must group by canonical supplier (include FOOD_SUPPLIES / BEVERAGES / etc., not only SUPPLIERS).
6. Existing bad rows: user can **Sync ledger from documents** after deploy to rebuild dates/VAT/supplier labels from stored document data. Rows whose stored extraction already used today’s date need re-upload/re-analyze for a correct printed date.

## Files

- `client/src/cafe/lib/swissDocumentNormalize.ts`
- `client/src/cafe/lib/postLedgerFromFinancialData.ts`
- `client/src/cafe/services/geminiService.ts` (sanitize + prompt)
- `shared/financialReportAggregates.ts` + Reports tab supplier grouping
- Gemini prompt: printed invoice date + TVA amounts + clean issuer
