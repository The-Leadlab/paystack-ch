# Single active session — Super Prompt

**Policy:** One browser session per Firebase **login** (uid). New sign-in revokes the previous client. Needed for shared credentials (e.g. Catholic Group: owner pays, staff upload).

**Not the same as:** team invites (different uids on one workspace) — those stay multi-session.

---

## Mechanism

1. On successful `signIn` / `signInWithGoogle` / `signUp`: generate `clientSessionId` (uuid), store in `sessionStorage`, write `users/{uid}.activeClientSessionId` + `activeClientSessionAt` (Firestore merge).
2. While authenticated: every 60s and on `visibilitychange` focus, read `activeClientSessionId`; if ≠ local → `signOut()` + toast `sessionKicked`.
3. Optional: `onSnapshot(users/{uid})` for instant kick when another device logs in.

**Disable:** `VITE_SINGLE_ACTIVE_SESSION=false` for dev multi-tab testing.

---

## Concurrent uploads

With single session, two humans cannot hold the same credential simultaneously — upload races on one `restaurantId` are avoided.

Team members (workspace invite) use **their own** uid → no single-session conflict; test upload concurrency separately before relaxing policy.

---

## Code map

| Piece | Path |
|-------|------|
| Session claim/verify | `client/src/cafe/lib/activeClientSession.ts` |
| Auth hooks | `client/src/cafe/context/AuthContext.tsx` |
| i18n | `dashboardTranslations` → `sessionKicked`, `sessionKickedHint` |

---

## Acceptance

- [ ] Login A → Login B same account → A signed out within 60s (or on focus).
- [ ] Team member B on invite ≠ kicked when owner A uses app.
- [ ] Dev: flag off allows two tabs same uid.
