# Batch processing demo UX — Super Prompt

**Symptom:** Demo shows one file “processing” at top, ~20 rows with status circles, nothing completes — embarrassing in front of clients.

**Root causes:**

1. Firestore rows left in `processing` after tab close / timeout / deploy — UI shows spinner forever.
2. Pool runs 4 workers but UI only distinguishes `pending` vs `processing` — queued rows look idle or all look “in progress”.
3. `stats.completed/total` counts all rows, not **this batch** progress.
4. Auto-start failed silently (quota, rate limit, missing `fileRaw`) while global `isProcessing` flipped false.

---

## Required UX

| State | Pill | Spinner |
|-------|------|---------|
| Active in worker pool | Processing | Yes |
| Waiting in queue while batch running | Queued | No |
| Pending (batch not running) | Pending | No |
| Stale `processing` (>20 min, not in pool) | Pending (recoverable) | No |

**Banner while batch runs:** `{active} active · {queued} queued · {done}/{batchTotal} done`

**Stale recovery:** On load, rows `processing` with `updated_at` or `created_at` older than 20 minutes → set `pending` in Firestore (if `canWrite`) and local state.

---

## Code map

| Piece | Path |
|-------|------|
| Processor UI | `client/src/cafe/components/DocumentProcessor.tsx` |
| Stale helper | `client/src/cafe/lib/staleDocumentStatus.ts` |
| Pool | `client/src/cafe/lib/runDocumentBatches.ts` |
| Fetch docs | `client/src/cafe/context/DocumentContext.tsx` |

---

## Acceptance

- [ ] Drop 20 files: max 4 spinners; rest show **Queued** until picked up.
- [ ] Reload mid-batch: stale `processing` becomes **Pending**, not spinner.
- [ ] Banner counts match console pool (no “done 0/20” for 10 minutes while workers run).
