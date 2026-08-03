# Super Prompt — Document list duplicates (pending + completed)

Swiss finance SaaS `/app` dashboard: after upload + refresh, each file appeared twice (PENDING empty + COMPLETED with data). Counter showed e.g. `3 / 6 DONE` for 3 files.

## Root causes

1. **Google Drive auto-sync on session load** re-imported files the app had already backed up to Drive, because `uploadedDocuments` values are `{ fileId, categorized }` objects but sync treated `Object.values(...)` as Drive file id strings — so `uploadedDriveIds.has(file.id)` never matched.
2. **Client** could also show a local queue row beside the Firestore row, or leave an orphan pending twin in Firestore after a second `addDocument`.

## Rules

1. When syncing Drive → platform, skip Drive file ids present in `importedDriveFiles` **or** in `uploadedDocuments` (normalize string | `{ fileId }` entries).
2. Client `syncFromGoogleDrive` must not `addDocument` when the session already has the same `fileName` or `storagePath`.
3. On Firestore fetch, **dedupe** by `fileHash` / `storagePath` / filename (pending ghost vs completed), keep the richer row, delete orphan duplicate ids.
4. DocumentProcessor `allDocs` must not list a local row that is already mirrored in Firestore (`persistedDocumentId` / hash / name); clear local mirrors after save.
5. Queue/complete must **update** the existing Firestore id — never create a second document for the same file.

## Files

- `lib/googleDriveSync.ts` — fix uploaded Drive id collection
- `client/src/cafe/lib/dedupeProcessedDocuments.ts`
- `client/src/cafe/context/DocumentContext.tsx`
- `client/src/cafe/components/DocumentProcessor.tsx`
- `client/src/cafe/components/RestaurantDashboard.tsx` — queue reuse + Drive import skip
