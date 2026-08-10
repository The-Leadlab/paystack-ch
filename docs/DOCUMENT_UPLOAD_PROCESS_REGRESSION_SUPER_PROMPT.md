# Document upload/process regression — Super Prompt

## Symptom (after page-split / file-memory work)

- Multiple PDFs stuck **EN ATTENTE** then all **ERREUR**: `Missing source file…`
- Console: `QuotaExceededError` (Firebase), `Firebase Auth timed out`, sometimes `currentSession: null`
- Cache path: `reading Cache API by Firestore id` → fail (no `fileUrl` either)
- User report: **files used to store and process before these changes**

## Root causes (stacked)

1. **Storage upload was moved to background** in `handleQueueDocument`  
   → processing often starts with **no `fileUrl` / `storagePath`** on the Firestore row.

2. **Aggressive Cache API backups** of multi‑MB PDFs  
   → browser storage **QuotaExceededError**  
   → Firebase Auth IndexedDB persistence fails  
   → Auth timeout / flaky session  
   → further Storage/Auth failures.

3. **processDoc** then requires local File / Cache / memory; without `fileUrl` it throws **Missing source file** instead of the old “upload then AI” path.

## Restore working behavior (priority order)

1. **Await Firebase Storage upload again** before returning from queue (as on `0cd8eab`).
2. **Stop / soft-limit Cache API** — do not store large PDFs in Cache; on `QuotaExceededError` clear the doc cache and continue.
3. **Auth persistence**: prefer `browserLocalPersistence` (avoid IndexedDB when quota is tight); keep assertion guard.
4. **processDoc source order**: `fileRaw` → memory → **Storage download via `fileUrl`** → only then re-attach message.
5. Keep page-split (pdf.js) and in-memory File handoff — they must not replace Storage as the durable source.

## Acceptance

- [ ] Fresh multi-file upload: each row gets `fileUrl` + processes (or shows real AI/Storage error, not Missing source)
- [ ] No `QuotaExceededError` storm from doc Cache on typical sessions
- [ ] Auth stays signed in; session selected; documents fetch runs
- [ ] Ticket-style multi-page PDF still page-splits when local File is present

## Out of scope

- Firebase Console quota billing changes
- Open Banking
