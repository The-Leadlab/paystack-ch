# Storage, liability, Drive + local — Super Prompt

**Policy:** Paystack is **not** long-term document custody. Users connect Google Drive and/or keep files locally. Terms: limited liability; user responsible for backups.

---

## Gaps today

- Drive backup runs after AI when connected; no user setting for **also save to computer**.
- No explicit **Storage policy** panel (Firebase Storage retention vs Drive-only).
- Legal pages may not state liability / data custody (verify site footer links).

---

## Settings (Billing or Documents)

| Option | Behavior |
|--------|----------|
| Drive connected | Mirror to `Paystack Documents / Business|Personal / YYYY-MM-DD /` |
| **Download after process** | Browser download of original (or processed JSON export) when AI completes |
**Operator default (confirmed):** When Drive is connected → **Drive mirror + auto-download** a copy to the user’s computer after AI completes.
| Firebase Storage | Short TTL for AI pipeline only (existing); optional “delete after Drive OK” |

Store in `users/{uid}.storagePrefs`: `{ driveMirror: boolean, localDownload: boolean, deleteStorageAfterDrive: boolean }`.

---

## Connect Drive flow

- Checkbox: “I authorize Paystack to copy uploaded documents to my Google Drive.”
- Link to Terms § data & liability.

---

## Code map

| Piece | Path |
|-------|------|
| Drive backup | `client/src/cafe/lib/googleDriveClient.ts` |
| Post-process hook | `DocumentProcessor.tsx` after `onDataExtracted` |
| Personal mirror | `personalStatementDriveBackup.ts` |
| Settings UI | `GoogleDriveConnectPanel.tsx`, `PersonalGoogleDrivePanel.tsx` |

---

## Acceptance

- [ ] User can enable “Save a copy on my computer” without disconnecting Drive.
- [ ] Terms/consent mention custody + liability (legal copy from operator).
- [ ] EN/FR settings labels.
