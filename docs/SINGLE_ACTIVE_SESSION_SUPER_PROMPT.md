# Shared multi-login (same account) — Super Prompt

**Policy:** Any second (or later) browser signed in with the **same Firebase uid** enters **view-only**, can **request upload access**, and after the primary approves receives a **new upload session** with rename-or-skip. There is **no** exclusive vs shared product choice — this applies to all accounts (business and personal).

**Not the same as:** team invites (different uids on one workspace) — those stay multi-session with their own primary.

---

## Flow

1. **Login A** (first client): claims `users/{uid}.activeClientSessionId` → role `primary` → full write.
2. **Login B** (same email/password, other browser): does **not** overwrite primary → role `viewer` → dashboard read-only + “Request upload access”.
3. Primary sees pending request → **Approve** creates a new named session (or Deny).
4. Viewer becomes `contributor` on the granted session only → `SessionNamePrompt` (rename or skip).
5. Contributor may mutate data only while `currentSessionId === grantedSessionId`.

**Disable registration of roles:** `VITE_SINGLE_ACTIVE_SESSION=false` for local multi-tab testing without view-only.

---

## Code map

| Piece | Path |
|-------|------|
| Session claim / viewer role | `client/src/cafe/lib/activeClientSession.ts` |
| Access requests | `client/src/cafe/lib/sessionAccessRequests.ts` |
| UI banner + approve dialog | `client/src/cafe/components/SessionAccessBanner.tsx` |
| Rename / skip prompt | `client/src/cafe/components/SessionNamePrompt.tsx` |
| Write gate | `client/src/cafe/hooks/useDataWriteAccess.ts` |
| Always-shared mode | `shared/loginMode.ts` + `persistLoginMode.ts` |
| Auth hooks | `client/src/cafe/context/AuthContext.tsx` |

---

## Acceptance

- [ ] Login A → Login B same account → B is view-only; A stays signed in (not kicked).
- [ ] B requests access → A approves → B gets a new session and rename/skip prompt.
- [ ] Checkout `/start-trial` has **no** exclusive/shared picker.
- [ ] Team member on invite (other uid) is unaffected.
- [ ] Dev: flag off allows two tabs same uid without view-only.
