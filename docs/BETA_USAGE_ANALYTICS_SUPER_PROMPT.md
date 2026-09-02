# Beta / accountant usage analytics — Super Prompt

**Goal:** Verify beta testers (Glanville accountants: Seb, Michael, Anka, Damian, Roger) — logins, session time, uploads, errors — without trusting feedback alone.

---

## Metrics (per uid / workspace)

| Metric | Source |
|--------|--------|
| Login count (30d) | `userActivity` events `login` |
| Last login | Firebase Auth `lastSignInAt` + last `login` event |
| Session duration | Heartbeat every 5 min while `/app` focused → sum `session_minutes` |
| Documents uploaded (month) | Existing `users.usage` + `documents` count |
| Errors (session) | `document_process_error` events with `errorCode` |
| Drive connected | `users.googleDrive` or integration doc |

---

## Schema

`userActivity/{auto}`: `{ uid, type, at, meta?: { errorCode?, fileName?, durationMs? } }`

`users/{uid}` aggregates (updated by Cloud Function or client batch):
`analytics: { logins30d, lastLoginAt, sessionMinutes30d, errors30d, lastActiveAt }`

**Operator model (confirmed):** Glanville accountants use **team invite** into each client workspace (`accountant` / viewer+export role), not shared owner password.

---

## Admin UI

Extend `AdminUserDetailPanel`:

- **Activity** card: last login, logins 30d, session hours 30d, docs this month, errors 30d.
- Sort user list by `lastActiveAt` for dead beta accounts.

---

## Privacy

- No document content in events — counts and codes only.
- Retention: 90 days raw events (operator configurable).

---

## Acceptance

- [ ] Open Glanville tester in admin → see last login < 7d if they claim daily use.
- [ ] CSV export: uid, email, logins30d, docsMonth, errors30d.
