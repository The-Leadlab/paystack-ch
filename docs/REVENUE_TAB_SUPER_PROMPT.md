# Revenue Tab Super Prompt (Phase 2)

## Goals

1. **Revenue tab** — richer charts (monthly revenue, payment split, revenue by type) and KPIs.
2. **Z-reading** — inline workspace on Revenue (auto / upload / manual); no “Add Z-reading” gate.
3. **AI Z-reading** — Gemini hint + `parseZReadingFromFinancialData` for cash/card/VAT extraction.
4. **Unified reports** — download (print HTML) and email attachment use `shared/financialReportHtml.ts`.
5. **Ledger toggle** — `users.revenueLedgerEnabled` controls Revenue tab table + PDF/email inclusion.

## Key files

| Area | Path |
|------|------|
| Revenue UI | `client/src/cafe/components/POSManager.tsx` |
| Ledger table | `client/src/cafe/components/RevenueLedgerTable.tsx` |
| Ledger pref | `client/src/cafe/hooks/useRevenueLedgerPrefs.ts` |
| Z-reading AI | `client/src/cafe/lib/posZReading.ts` |
| Shared HTML | `shared/financialReportHtml.ts` |
| Server email | `lib/buildServerFinancialReport.ts`, `api/reports/email.ts`, `api/reports/cron.ts` |
| Client PDF | `client/src/cafe/services/reportExportService.ts` |

## Email attachment

Full report is attached as `paystack-financial-report-*.html` (same HTML as in-app PDF print). Recipients open and print to PDF for identical layout.

## Testing

- Revenue: charts render; Z-reading workspace visible without modal; upload photo fills form; save works.
- Reports: toggle ledger on Reports + Revenue; PDF download includes ledger when enabled.
- Email: send report; attachment matches download content.
