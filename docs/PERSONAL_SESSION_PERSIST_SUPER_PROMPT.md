# Personal session persist + 35-doc cap + invite visibility — Super Prompt

Related: `docs/PERSONAL_AI_SESSIONS_SUPER_PROMPT.md`.

## Bugs observed

1. After upload/analysis, Overview / Budget / Reports stay empty (or flash then clear).
2. On page refresh, imported file/data **disappears**.
3. Need **35 document** upload limit across **all** personal sessions.
4. **Invite** must let teammates see the owner’s personal ledger/tabs.

## Root cause

`usePersonalBudgetLedger` uses Firestore whenever the user is signed in (`useCloud`). Permission-denied (or empty cloud) imports were saved to **IndexedDB**, then `refresh()` reloaded **only** Firestore → empty UI and empty after refresh.

## Required fixes

1. **Dual-write**: always commit statement rows to IndexedDB; mirror to Firestore when allowed (same ids + `sessionId` + `restaurantId = dataOwnerUid`).
2. **Merge on read**: load IndexedDB ∪ Firestore; keep local-only rows; cloud wins on id conflict.
3. **Session binding**: every import + tx stores `sessionId`; Overview shows imports for the current session; ledger KPIs use current session (or all if “All sessions”).
4. **Hard cap 35**: block upload when total personal imports across all sessions ≥ `maxPersonalDocumentsPerMonth` (default **35**), not only the monthly usage counter.
5. **Invite**: confirm workspace `dataOwnerUid` scopes personal ledger reads/writes; invitees read owner Firestore personal_* collections; copy clarifies they share personal finances.
6. Surface import list on Overview so uploaded files remain visible after refresh.

## Isolation

Still never write personal statement rows into business Revenue.

## Agent checklist

```
1. Write this super prompt.
2. Dual-write + merge in usePersonalBudgetLedger / commit paths.
3. sessionId on imports/txs; filter by current personal session.
4. Enforce 35 imports across sessions.
5. Invite copy + verify owner-scoped personal reads for members.
6. Overview import history; push.
```
