# Document batch, mixed EN/FR, and error-storm — Super Prompt

Use this when a real session looks like: **UI language mixed EN/FR**, **~40 documents taking over an hour**, and **4–5 different error texts** on the same Documents table.

Related: `docs/GEMINI_FAILED_TO_FETCH_SUPER_PROMPT.md`, `docs/DOCUMENT_UPLOAD_PROCESS_REGRESSION_SUPER_PROMPT.md`, `docs/FIREBASE_AUTH_ASSERTION_AND_PDF_HANG_SUPER_PROMPT.md`, `docs/I18N_SUPER_PROMPT.md`, `docs/TICKET_PDF_STORAGE_DOWNLOAD_TIMEOUT_SUPER_PROMPT.md`.

---

## What the operator actually sees

1. Status pills and buttons in French (`En cours`, `Erreur`, `Retraiter`) next to **English** error sentences (or the reverse if they switched to EN).
2. Verification / Swiss TVA chrome half-translated (`Base HT`, `Open Raw Trace`, `Form code`, `+ Rate row`) while the rest of `/app` follows `paystack_language`.
3. Dropping a large set (e.g. **41 files**) auto-starts processing and the queue sits there **well past an hour**.
4. Failed rows show **different raw messages** (network, timeout, missing file, save, quota) so it feels like five unrelated bugs.

These are stacked, not three separate mysteries.

---

## Where it breaks (file map)

| Layer | File | What goes wrong |
|-------|------|-----------------|
| Queue | `client/src/cafe/components/DocumentProcessor.tsx` | Default concurrency was **1**. `processAll` treated `pending` **and** `error` **and** `skipped` as the same queue. Auto-start after upload called `processAll()` for **the whole table**, so old failures were retried in front of new files. Errors stored as English `error` strings and rendered as-is. |
| Timeouts | `client/src/cafe/lib/documentProcessingTimeout.ts` | Any PDF ≥ **80 KB** used `3 × GEMINI_CLIENT_FETCH_TIMEOUT_MS` (~292 s) ≈ **15 minutes wall-clock per file**. Page-split tickets budgeted **~322 s per page** (capped at 30 min). One stuck PDF blocked the entire serial queue. |
| Pool | `client/src/cafe/lib/runDocumentBatches.ts` | Wait-for-full-batch + default size 1 = strictly serial. Comment explains “Failed to fetch” from parallel calls — valid for 5 huge PDFs, not for 41 photos / 1-page invoices. |
| Extra AI | `DocumentProcessor` → `enrichFinancialDataWithSwissAccount` | Second Gemini call **after** extraction, with the same long client timeout. Adds minutes even when classification is optional. |
| Page split | `client/src/cafe/services/geminiService.ts` + `pdfPagesToImages.ts` | Ticket-named multi-page PDFs analyze **one JPEG per page, sequentially**. A 15-page “Ticket février” is 15 AI round-trips **inside one** `processDoc`. |
| Source file | `processDoc` | Memory/Cache miss → wait up to 5 s for `fileUrl` → Storage download (90 s) → **Missing source file** / **Storage download timed out**. Five different wordings for “we don’t have the bytes”. |
| i18n | `LanguageContext.tsx` `t()` | Missing key → **raw key name**. No fallback table. Keys exist in `dashboardTranslations.ts` (`dpFormCode`, `dpAddRateRow`, …) but Swiss TVA JSX was **hardcoded English/FR mix**. |
| i18n audit | `scripts/i18n-key-parity.mjs` | Only scanned inline `LanguageContext` blocks — **ignored** `dashboardEn`/`dashboardFr` and `tourEn`/`tourFr`. |
| Classifier labels | `swissAccountClassifierService.ts` | Stored `labelFr / labelEn` on one line → bilingual noise in Verification. |

---

## Why 41 documents take more than an hour

Conservative math with the old defaults:

- Concurrency **1** → 41 files in series.
- Typical Gemini invoice: **60–120 s**. 41 × 90 s ≈ **61 minutes** even when nothing fails.
- If **any** file hits the ~15 min document timeout (slow PDF, cold function, retry), add 15 min **and** nothing else runs.
- `withRetry` in `geminiService.ts` can run the same call **3 times** (2 retries) on 429 / 5xx / network.
- Auto `processAll` after a second drop **re-queues previous errors**, so a 41-file session can become 41 + N retries without the operator intending it.

Prevention rule: **never let one document’s worst-case timeout be the queue’s throughput.** Use a worker pool; cap typical wall-clock; do not auto-retry `error` rows that need a new file.

---

## Why 4–5 different error messages

They were **not** five product features. They were unmapped `throw new Error(...)` strings from different layers, persisted on the Firestore row:

| Family (code) | Typical raw text | Real cause | Operator action |
|---------------|------------------|------------|-----------------|
| `source_missing` | Missing source file… / Re-attach / Storage download timed out | Bytes gone after local row drop, Cache quota, or Storage lag | Re-attach file |
| `network` | Cannot reach the AI server (Failed to fetch) | Proxy/Vite/Vercel/offline | Retry when online; local: Gemini in Vite |
| `timeout` | Processing timeout (Ns) / AI request timed out / 504 | Too-long budget or huge PDF / page-split | Retry once; split PDF |
| `quota` | 429 / Gemini quota | Parallel burst or Google quota | Wait, then retry |
| `page_limit` | PDF_PAGE_LIMIT:N:7 | Business PDF has more than 7 pages | Split the PDF, upload again |

**Prevention:** classify at the boundary (`documentProcessError.ts`), store `errorCode` + technical `error` (tooltip / logs only), show **one** localized sentence per family. Do not invent a sixth toast for the same family.

---

## Why EN/FR looks mixed on both settings

1. **Chrome vs payload:** `t('dpStatusError')` is localized; `doc.error` is English (or leftover French from an old session) and does not change when the user toggles language.
2. **Hardcoded JSX** in Documents verification (Swiss TVA table, “Open Raw Trace”) while neighboring labels use `t()`.
3. **Accounting bilingualism** (`TVA`, `HT`, `TTC`) mixed into English sentences, and `labelFr / labelEn` concatenated.
4. **Stale Firestore errors** from a previous language/session.
5. **Parity holes:** a key added only to `dashboardEn` renders as `dpSomeKey` (or English fallback) in FR.

**Prevention:** user-visible processor copy goes through `t()`. Errors are **codes**; `formatDocumentProcessError(code, t)` runs at render time so toggling EN/FR rewrites the sentence. `node scripts/i18n-key-parity.mjs` must cover dashboard + tour tables. New processor UI without `t()` is a regression.

---

## Required behavior (acceptance)

- [ ] Drop 20+ small invoices/JPGs: several run **in parallel** (default 3), ETA scales ~1/3 vs serial. Stop still aborts the pool.
- [ ] Typical PDF wall-clock budget is **minutes, not 15–30 min**, unless `deepPdfInvoiceBeta` or a real ticket page-split.
- [ ] Auto-start after upload processes **only the new pending files**, not historical errors.
- [ ] Start processing button retries **retryable** errors (network/timeout/quota/ai/save) but asks **Re-attach** for `source_missing` without a local File.
- [ ] Error rows show **one of six localized families**; technical detail is `title` tooltip only.
- [ ] PDFs over **7 pages** are rejected on upload (banner + row `page_limit`); AI does not run. Bank-statement PDFs are exempt.
- [ ] Documents tab + Swiss TVA + Open raw trace follow EN or FR with **no** hardcoded English in FR and no leftover French chrome in EN (except Swiss legal tokens TVA/HT where the glossary keeps them).
- [ ] `node scripts/i18n-key-parity.mjs` exits 0 (LanguageContext + dashboard + tour).

---

## Agent instructions

```
Apply docs/DOCUMENT_BATCH_I18N_ERRORS_SUPER_PROMPT.md.

1. Worker pool (default concurrency 3, cap 6 via VITE_DOCUMENT_PROCESSING_CONCURRENCY).
2. Rewrite resolveDocumentProcessingTimeoutMs — do not treat 80KB PDFs as 3×300s.
3. Classify errors into source_missing | network | timeout | quota | save | ai | page_limit; persist errorCode; display t('dpErr…').
4. Auto-process only newly queued pending docs; processAll(includeErrors) from the button. Do not retry page_limit.
5. Wire Swiss VAT editor + Open Raw Trace to dashboardTranslations.
6. t() should not echo missing keys silently in production UX for these errors — add keys in BOTH dashboardEn and dashboardFr.
7. Extend scripts/i18n-key-parity.mjs to dashboardTranslations.ts and tourTranslations.ts.
8. Cap Swiss account classify so it cannot inherit the full Gemini fetch timeout.
9. Reject business PDFs over 7 pages (notify, no AI). Bank statements stay uncapped.
10. Do not promote Ali lab. Do not push unless asked.
```

---

## Out of scope

- Open Banking / live bank sync
- Raising Google Gemini quota in Cloud Console (ops)
- Changing Vercel `maxDuration` (already 300 s for `/api/gemini`)
- Replacing Firebase Auth

---

## How to keep this from coming back

1. **New `throw new Error` in the document path** must go through `classifyDocumentProcessError` (or throw an already-classified code). Do not persist a new English sentence as the only UI.
2. **New Documents / verification strings** land in `dashboardEn` **and** `dashboardFr` in the same PR; run `node scripts/i18n-key-parity.mjs`.
3. **Do not lower concurrency to 1** as a blanket “Failed to fetch” fix. Prefer same-origin Gemini in Vite, one retry, and **slot weights** for huge PDFs.
4. **Do not add another sequential Gemini pass** (classifier, line-item recovery, exhaustive read) without a **short dedicated timeout** and a skip if the main analysis already succeeded.
5. **Page-split** stays for ticket binders only; never apply “one AI call per page” to ordinary invoices.
6. After a production incident, paste the **errorCode histogram** (not five raw strings) into the next prompt.

## Local test

1. `pnpm dev` (Gemini in-process; `GEMINI_API_KEY` in `.env`).
2. `/app` → Documents → drop 6 small PDFs/JPGs: more than one `En cours` at a time.
3. Toggle EN/FR: error lines and TVA table headers switch; no `Open Raw Trace` in FR.
4. Stop processing mid-queue; remaining stay pending, not silent forever.
5. Force a missing-file row (process after reload without File): one `source_missing` message + Re-attach, not a 15-minute timeout.
