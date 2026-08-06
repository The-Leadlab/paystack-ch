# Personal shell cleanup + invite with seat paywall — Super Prompt

## Goals

1. Remove the two top bars on Personal (`/personal` and `/ali` personal shell) that show budget/statement messaging — remove the **entire bars**, not just copy.
2. Add a clear **Invite** control on Personal so owners can invite household members.
3. When inviting would exceed included seats (owner + 1 free), require purchasing an **extra seat (CHF 5/mo)** via existing Personal add-on checkout, then allow the invite.

## Bars to remove

| Bar | Location |
|-----|----------|
| Statement/budget banner | `PersonalPlanShell` — `personalTabsBanner` + `personalTabsEmptyHint` strip |
| Session / budget bar | `PersonalSessionBar` usage in shell |

Keep sidebar “Add transaction” and Overview upload UI.

## Invite + payment

- Reuse `/api/team` invite flow; Personal owners get accept links to `/personal?team_invite=…` (PlatformPage already accepts the query on `/personal`).
- Seat math: `PERSONAL_INCLUDED_SEATS = 2` + `personalAddonSeats`.
- On seat-limit error, UI offers **Add seat** → `purchasePersonalAddon("seat")` (Stripe).
- Return structured `code: "SEAT_LIMIT"` from invite API when applicable.

## Out of scope

- Open Banking
- Changing restaurant TeamInvitePanel beyond shared API codes
