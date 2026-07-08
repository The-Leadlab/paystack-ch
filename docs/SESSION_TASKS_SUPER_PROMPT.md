# Session Tasks — Super Prompt

Use this when building or hardening **personal session checklists** in Paystack.ch. This is a **standalone module** — not grouped under shared-access, goals, or other “in progress” lab items.

---

## Goal (one sentence)

After the user **opens a session**, they get a dedicated **Tasks** screen to add/remove/check off items and see **personal progress** (% complete) for that session only.

---

## UX rules

| Rule | Detail |
|------|--------|
| **Separate module** | Own nav item + route — do not embed in chat, goals, or overview KPIs |
| **Session gate** | If no session is active, show session cards (“Open session checklist”) — do not show task list |
| **No chat progress button** | Do **not** add a “Progress” button on the right of any chat/assistant panel — progress lives inline on `/session-tasks` only |
| **Per-session data** | Tasks are scoped by `sessionId`; switching session shows that session’s list |
| **CRUD** | Add task (input + button), toggle done (checkbox), remove (delete) |
| **Progress** | Header shows `X of Y complete` + bar + `%` — no separate floating progress control |

---

## Routes

| Surface | URL |
|---------|-----|
| Production | `/app/personal/session-tasks` |
| Lab | `/ali/session-tasks` |

Session bar link: **Session tasks** → same route for current surface.

---

## Data model

Firestore collection: `ali_lab_session_tasks`

```typescript
{
  restaurantId: string;   // uid
  sessionId: string;      // sessions/{id}
  label: string;
  done: boolean;
  createdAt: string;      // ISO
}
```

Local fallback: `localStorage` key `ali-lab-session-tasks-{uid}` via `useAliLabPersist`.

---

## Files

| Piece | Path |
|-------|------|
| Panel | `client/src/ali-lab/features/SessionTasksPanel.tsx` |
| Registry | `client/src/ali-lab/featureRegistry.ts` → `session-tasks` |
| Nav | `client/src/ali-lab/personal-plan/personalPlanNav.ts` |
| Session bar link | `client/src/ali-lab/personal-plan/components/PersonalSessionBar.tsx` |
| Types | `client/src/ali-lab/types.ts` → `LabSessionTask` |
| Firestore | `client/src/ali-lab/aliLabFirestore.ts` |
| Rules | `firestore.rules` → `ali_lab_session_tasks` |

---

## Status in product docs

Mark **Session tasks** as **Implemented** in `docs/PAYSTACK_FEATURES_STATUS_SUPER_PROMPT.md` — not “In progress”.

---

## Verification

```bash
pnpm dev
# Signed in:
/app/personal/session-tasks     → pick session → add tasks → check off → delete
/ali-gate → /ali/session-tasks  → same flow in lab
```

Build: `pnpm build` before push.

---

## Agent copy-paste block

```
Implement session tasks as a separate personal module:
- Route /app/personal/session-tasks (+ /ali/session-tasks)
- Session picker when no active session; task list when session selected
- Firestore ali_lab_session_tasks with sessionId scope
- Inline progress bar (no Progress button beside chat)
- Nav item "Tasks" + session bar link
- Update feature status doc as Implemented
```
