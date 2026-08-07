# Personal E2E + Google Drive — Super Prompt

Related: `docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md` (ledger isolation).
Related: business Drive backup under `Paystack Documents` (week folders).

## Goal

1. Exercise **all personal features** for a real account (`ali@the-leadlab.com`): statement upload, ledger, overview KPIs, budget/reports/goals/bills surfaces.
2. Create a sample **bank statement PDF** (+ CSV twin), import into that user’s **personal** ledger (Firestore when signed in).
3. Link **Google Drive** on the personal surface: under existing `Paystack Documents`, create **`Personal / {YYYY-MM-DD} /`** and store personal uploads there for every personal user who connects Drive.
4. Spot bugs, fix them, publish a visible test report, then **push**.

## Hard rules

- Personal imports must **never** go through restaurant Revenue / Documents business paths.
- Storage paths stay under `documents/{uid}/…` (ownership checks). Prefer `documents/{uid}/personal/{date}/…`.
- Drive personal tree: `Paystack Documents / Personal / {upload-or-doc-date} / file`.
- Do **not** mark Ali lab features `promoted` unless the user explicitly approves after testing.
- Open Banking / live `bank-sync` stays out of scope.

## Drive API contract

- `DriveUploadFile.workspace`: `"business"` (default) | `"personal"`.
- Client `backupDocumentToGoogleDrive({ …, workspace: "personal", documentDate })`.
- OAuth may carry `returnPath` (e.g. `/personal/overview`) so Connect from personal lands back on personal.

## Agent checklist

```
1. Write/update this super prompt.
2. Extend saveDocumentToDrive for workspace=personal (Personal + date folders).
3. Backup personal statement uploads to Drive (best-effort, never block import).
4. Show Google Drive connect on personal Overview.
5. Generate fixtures/personal-bank-statement.{pdf,csv}; seed ali@ ledger + Storage.
6. Run CSV parse + Drive unit tests; note Drive OAuth requires user consent once.
7. Canvas/report with pass/fail; fix bugs found.
8. Commit and push when user asked (this prompt asks to push).
```

## File map

| Path | Role |
|------|------|
| `lib/googleServices.ts` | Personal folder helpers + `workspace` on save |
| `lib/googleDriveSync.ts` | Pass `workspace` from API body |
| `client/src/cafe/lib/googleDriveClient.ts` | Client payload + OAuth returnPath |
| `client/src/ali-lab/lib/personalStatementDriveBackup.ts` | Upload → Storage → Drive personal |
| `client/src/ali-lab/personal-plan/components/PersonalStatementUpload.tsx` | Trigger backup after commit |
| `client/src/ali-lab/features/PersonalDashboardPanel.tsx` | Drive connect panel |
| `scripts/seed-personal-ali-e2e.mjs` | PDF/CSV + Firestore seed + results JSON |
| `fixtures/personal/` | Sample statement files |
