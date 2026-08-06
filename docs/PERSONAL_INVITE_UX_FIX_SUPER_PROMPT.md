# Personal invite UX fix — Super Prompt

## Goals

1. Remove the inline **Invite someone** box from Personal Overview.
2. Fix the sidebar / More-sheet **Invite** button (hash `#invite` did nothing once the box was gone or when already on Overview).

## Approach

- Invite opens a **modal** (`PersonalInviteModal`), same pattern as Add transaction.
- `PersonalPlanContext` exposes `inviteOpen` / `openInvite` / `closeInvite`.
- Sidebar and mobile More sheet call `openInvite()` — no hash links.
- Seat paywall (`SEAT_LIMIT` → CHF 5 add-on) stays inside the modal.

## Out of scope

- Changing seat pricing or team API contract beyond existing codes.
