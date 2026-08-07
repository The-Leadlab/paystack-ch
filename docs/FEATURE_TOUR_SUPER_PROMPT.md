# Feature tour (Personal + Business) — super prompt

## Goal

After onboarding (or via Restart tour), show a lightweight coach-mark tour with **Next**, **Back**, and **Skip tutorial**. Separate step lists for Personal (`/personal`) and Business (`/app`). No heavy third-party library.

## Storage keys

- `paystack-personal-tour-done` — `"1"` when finished/skipped
- `paystack-business-tour-done` — same
- Optional step index not required if we always restart from 0

## Engine

Shared under `client/src/components/product-tour/`:

- Spotlight / anchored popover over `[data-tour="…"]` targets
- Skip missing targets (advance to next found)
- Dim backdrop; popover with title, body, Next / Back / Skip

## Personal steps (examples)

Overview KPIs, statement upload, Budget, Reports, Savings, Investments, Bills, Settings, Add transaction, sidebar collapse.

## Business steps

Sessions list, New session, Dashboard / Revenue / Expenses / Documents, Billing, Personal link, sidebar collapse.

## Restart

- Personal Settings: “Restart product tour”
- Business sidebar tools / foot: same control

## Out of scope

Open Banking; promoting Ali lab into `/app`; fullscreen chrome hide.
