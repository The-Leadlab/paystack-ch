# Ticket PDF: Storage download timeout — Super Prompt

## Symptom

`Ticket fevrier .pdf` → **ERREUR**: `Storage download timed out after 60s`

Console:

```
[Ticket fevrier .pdf] reading local Cache API backup
[Ticket fevrier .pdf] downloading from Firebase Storage
❌ Error: … Storage download timed out after 60s
```

## Root cause

1. Upload creates a **local** row with `fileRaw` (the actual PDF bytes in memory).
2. `onDocumentQueued` writes Firestore + Storage; Cache API backup was **fire-and-forget** (race).
3. When Firestore snapshot arrives, DocumentProcessor **drops the local mirror** as a duplicate — **`fileRaw` is discarded**.
4. Processing then runs on the Firestore row with **no** `fileRaw`, Cache miss, and a large Storage re-download that hits Auth/SDK retries and times out.

Page-split **requires** local bytes (pdf.js). Re-downloading a 3.5MB scan from Storage is the wrong path when we just had the File.

## Fix

1. **In-memory File registry** keyed by Firestore id / hash / name — survive local-row drop.
2. **Merge `fileRaw` onto Firestore docs** in `allDocs` from that registry.
3. **Await `cacheDocumentFile`** in `handleQueueDocument` before returning (no race).
4. **Do not block queue** on Storage upload for AI — upload in background; processing uses `fileRaw`.
5. Harden `downloadDocumentFile` with **per-attempt timeouts** + optional `storagePath` (last resort only).
6. On download failure: clear error → **Re-attach file** CTA (already exists; make message explicit).

## Acceptance

- [ ] Fresh upload of Ticket fevrier processes from `fileRaw` (logs `source ready` without Storage download)
- [ ] Retry after Firestore mirror still finds File in memory/cache
- [ ] Storage download only if memory + cache miss; fails fast with re-attach message
- [ ] Auth assertion does not force a Storage round-trip

## Out of scope

- Server-side Poppler
- Changing Firebase project / CORS console settings (app-side resilience first)
