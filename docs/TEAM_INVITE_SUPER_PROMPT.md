# Team invites + shared dashboard — Super Prompt

Use when implementing or extending **email invites** so plan seats can share one Paystack dashboard.

Related: `docs/ALI_LAB_SUPER_PROMPT.md` (shared-access lab prototype), `docs/NEW_USER_NOTIFY_SUPER_PROMPT.md` (Resend), `docs/STRIPE_CHECKOUT_SUPER_PROMPT.md`.

---

## Product goals

1. **Plan seats** — Starter = 1 seat (owner only). Business = 10. Unlimited = unlimited. Enforced via `maxTeamSeats` in `shared/planCatalog.ts`.
2. **Email invite** — Owner enters email → Resend sends accept link → invitee signs up/in with that email → accepts → sees **owner’s** sessions/documents/finances.
3. **Roles** — `editor` (read/write) or `viewer` (read-only). Owner always full access.
4. **Trial cancel (related billing)** — During trial, “End trial — no charge” calls `POST /api/stripe/cancel-subscription` which **cancels immediately** (no conversion charge). Paid cancel still uses Stripe Customer Portal.

---

## Agent instructions (copy-paste)

```
Implement / harden Team invites on Paystack.ch.

Rules:
1. Follow docs/TEAM_INVITE_SUPER_PROMPT.md.
2. Data stays keyed by restaurantId = workspace owner uid (not invitee uid).
3. Firestore rules must allow active workspaceMembers to read/write owner-scoped collections.
4. Invites + memberships are written only by Admin SDK (api/team).
5. Send invite email via lib/resendEmail.ts (RESEND_API_KEY).
6. Do not migrate personal IndexedDB ledger to shared storage in this pass (phase 2).
7. Do not promote Ali lab SharedAccessPanel as production — TeamInvitePanel on Billing is the product UI.
8. Do not push/commit unless asked.
```

---

## Schema

| Collection | Doc id | Fields |
|------------|--------|--------|
| `workspaceInvites` | auto | `ownerUid`, `ownerEmail`, `email`, `role`, `tokenHash`, `status` (pending/accepted/revoked/expired), `expiresAt` |
| `workspaceMembers` | **member uid** | `ownerUid`, `ownerEmail`, `email`, `role`, `status` (active), `joinedAt` |

Accept link: `{origin}/app?team_invite={rawToken}`

---

## Code map

| Piece | Path |
|-------|------|
| Entitlements | `shared/planCatalog.ts` → `maxTeamSeats`, `maxPersonalDocumentsPerMonth` |
| Server invites | `lib/workspaceInvites.ts` |
| API | `api/team.ts` + `server/team.ts` |
| Client scope | `client/src/cafe/context/WorkspaceContext.tsx` → `dataOwnerUid` |
| UI | `client/src/cafe/components/TeamInvitePanel.tsx` (Billing) |
| Accept | `PlatformPage` `TeamInviteAcceptEffect` |
| Rules | `firestore.rules` |
| Trial cancel | `lib/stripeBilling.ts` → `runCancelSubscription`, `api/stripe/cancel-subscription.ts` |

---

## Env

```env
RESEND_API_KEY=re_...
# Optional from address (falls back to NEW_USER_NOTIFY_FROM / REPORT_EMAIL_FROM)
# NEW_USER_NOTIFY_FROM=Paystack <notifications@paystack.ch>
```

Deploy updated `firestore.rules` after merge.

---

## Phase 2 (shipped)

- Personal ledger syncs to Firestore (`personal_transactions` / `personal_imports`) under the workspace owner when signed in — household members share `/app/personal` money data.
- Members inherit owner plan entitlements + usage (read `users/{ownerUid}`).
- Ali lab Firestore collections (`ali_lab_*`) use `dataOwnerUid` via `useAliLabPersist`.
- Members can **Leave workspace** from Billing → Team.

## Phase 3 (optional)

- One-click migrate local IndexedDB personal rows → Firestore for the owner.
- FairSplit settlements (keep in Ali lab until explicitly promoted).

---

## QA

- [ ] Starter: invite blocked with upgrade message
- [ ] Business: invite email arrives; accept with matching email opens owner dashboard
- [ ] Viewer cannot create sessions / expenses; editor can
- [ ] Remove member → access gone
- [ ] Member Leave workspace → back to own empty dashboard
- [ ] Trialing user: “End trial — no charge” → Stripe status canceled, no invoice
- [ ] Admin cancel on trialing user → immediate, no charge
- [ ] Personal statement uploads blocked at 35/mo when enforcement on
- [ ] Two members see the same personal ledger after one uploads a statement
- [ ] Starter marketing + entitlements show 35 docs/mo
- [ ] Deploy `firestore.rules` + `firestore.indexes.json`