# Team roles phase 3 — owner / manager / member — Super Prompt

**Later** — after single-session + usage analytics.

Today: `workspaceMembers.role` = `editor` | `viewer`. Owner invites from Billing. See `docs/TEAM_INVITE_SUPER_PROMPT.md`.

---

## Target roles

| Role | Upload docs | Billing | Invites | Reports | Budget (future) |
|------|-------------|---------|---------|---------|----------------|
| owner | yes | yes | yes | yes | yes |
| manager | yes | no | yes (members only) | yes | yes |
| member | yes | no | no | read | read |
| accountant | read + export | no | no | yes | read |

Map `accountant` ≈ current `viewer` + export; `manager` ≈ `editor` + invites.

---

## Enforcement

- Firestore rules: `canWrite` checks role on `workspaceMembers/{uid}`.
- UI hides Billing / Team for non-owner/manager.
- Catholic Group: prefer **separate team logins** over shared password once roles ship.

---

## Out of scope

- Per-seat Stripe billing changes (use existing `maxTeamSeats`).
- Budget module implementation (Ali lab `BudgetingPanel` prototype only).
