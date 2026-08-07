# Personal AI sessions + full-tab fill — Super Prompt

Related: `docs/PERSONAL_STATEMENT_AI_IMPORT_FIX_SUPER_PROMPT.md`, `docs/PERSONAL_E2E_DRIVE_SUPER_PROMPT.md`.

## Observed failure

Upload on `/personal/overview` shows Storage success, then UI error:

`ali-bank-statement-2026-07.pdf: Missing or insufficient permissions.`

Overview stays at CHF 0. Budget / Reports / Savings / Investments / Bills stay empty.

Likely causes:

1. Storage→server Gemini path or Firestore `personal_transactions` create denied (rules not deployed / membership mismatch).
2. No personal **sessions** UX (business has sessions; personal does not) → users cannot organize imports or stable Drive dedupe keys.
3. Import only writes the ledger — does **not** seed bills, savings goals, or investment suggestions from the statement.

## Product goal

One PDF/CSV upload in a **personal session** should:

| Surface | Behavior |
|---------|----------|
| Overview | Income / expenses / savings KPIs for the statement month |
| Budget | Category spend visible against the same personal ledger |
| Reports | Forecast / cash-flow uses imported rows |
| Savings | AI (or heuristic) creates starter savings goals from surplus |
| Investments | Recommend / seed holdings from dividend / pillar 3a / invest lines |
| Bills | Detect recurring Swiss bills (Swisscom, rent, Serafe, …) and add reminders |
| Google Drive | Backup once per file fingerprint under `Personal/{date}/`; never re-upload duplicates |

## Sessions (personal)

- Small **Sessions** control in the personal header (next to Light/Dark), not a full business sidebar clone.
- Create / rename / select / delete personal sessions (local IndexedDB + optional Firestore when rules allow).
- Statement imports and Drive `sourceId` include `sessionId` + content hash so the same file is not backed up twice.
- Default: auto-create “Personal 2026” (or current year) if none exists.

## AI / import pipeline (hard requirements)

1. Prefer **inline Gemini** for PDFs under ~3.5 MB (avoids Storage Admin round-trip permission failures).
2. Fall back to Storage-backed Gemini, then **PDF text extraction**.
3. Commit to Firestore when allowed; on permission errors **fall back to IndexedDB** personal ledger so Overview is never stuck at zero.
4. After commit, run **enrichPersonalFromStatement**: bills + goals + investment tips/holdings (dedupe by name).
5. Jump month picker to dominant statement month; toast success with counts.

## Isolation

Never write personal statement rows into business Revenue / Documents sessions.

## Agent checklist

```
1. Write this super prompt.
2. analyzeBankStatement preferInline for personal; keep text fallback.
3. Cloud commit → IndexedDB fallback on permission errors.
4. Personal sessions store + header Sessions control.
5. enrichPersonalFromStatement → bills / goals / holdings.
6. Drive backup sourceId = session + hash(file).
7. Tests for enrich heuristics; push.
```
