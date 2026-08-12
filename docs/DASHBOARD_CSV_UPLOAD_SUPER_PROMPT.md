# Dashboard CSV upload — Super Prompt

## Problem

Business `/app` Dashboard (and Documents) upload rejected CSV files. File picker `accept` listed only PDF/JPEG/PNG/WebP, and MIME checks ignored Windows Excel CSV quirks (`application/vnd.ms-excel` or empty type).

Revenue Z-reading already accepted CSV; Dashboard document AI upload did not.

## Goal

Allow **CSV** alongside PDF/JPG/PNG/WebP on the business Dashboard document upload zone so users can upload and AI-process CSV invoices/exports/statements.

Keep personal bank-statement CSV on `/app/personal` unchanged. Do not invent Open Banking.

## Must work

1. File picker shows/selects `.csv`
2. Drag-drop CSV queues and processes (not silently ignored)
3. Windows MIME quirks normalize to `text/csv` for Storage + Gemini
4. Clear error for truly unsupported types
5. Google Drive → app import accepts CSV MIME types
6. EN/FR drop-zone copy mentions CSV

## Key files

| Path | Role |
|------|------|
| `client/src/cafe/lib/businessDocumentFile.ts` | Shared accept + `isBusinessDocumentFile` + MIME normalize |
| `client/src/cafe/components/DocumentProcessor.tsx` | Dashboard/Documents upload |
| `client/src/cafe/components/QuickDocumentUpload.tsx` | Alternate upload UI |
| `client/src/cafe/lib/documentStorageForAi.ts` | `guessMimeType` → normalize |
| `client/src/cafe/services/geminiService.ts` | Inline Gemini MIME for CSV |
| `lib/googleDriveSync.ts` | Drive import MIME allowlist |
| `client/src/cafe/i18n/dashboardTranslations.ts` | `dpDropFiles` / `dpUnsupportedFiles` |

## Do / don't

- **Do** accept by extension *or* MIME (CSV often mis-typed on Windows).
- **Do** keep PDF multi-invoice / exhaustive passes PDF-only.
- **Don't** route Dashboard CSV through Revenue Z-reading column mapper unless the file is uploaded on Revenue.
- **Don't** change personal statement import.
