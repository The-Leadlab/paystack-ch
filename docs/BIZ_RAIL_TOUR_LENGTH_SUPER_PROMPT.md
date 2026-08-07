# Business icon-rail + short/long tours — super prompt

## Goals

1. **Business sidebar collapse** must match Personal: when collapsed, only a slim icon rail remains (~56px) and the main dashboard expands into the freed width. Icons stay; labels and empty column space must disappear.
2. **Onboarding** asks whether the user wants a **short tutorial**, a **long tutorial** (each tab + key features inside), or to skip.
3. **One-shot**: users who completed or skipped onboarding/tour must not see them again on later visits.
4. **Tester exception**: `ali@the-leadlab.com` always may re-see onboarding/tour for QA (ignore localStorage done flags for auto-start).

## Business rail fix

- Ensure collapsed class sets `width: 3.5rem` (or equivalent) on `.ba-sidebar` — today `ba-sidebar--rail` may omit width while expanded stays `13rem`.
- `overflow-x: hidden` on rail; center icon buttons; hide session list chrome that keeps the column wide.
- Main content is flex sibling — shrinking sidebar width is enough (no fixed `ml-*` on business).

## Tour length

Storage (per surface):

- `paystack-personal-tour-done` / `paystack-business-tour-done` — `"1"` when finished or skipped
- `paystack-personal-tour-length` / `paystack-business-tour-length` — `short` | `long` | `skip`

Onboarding step (near end): ChoiceCard Short / Long / Skip tutorial.

- **Short**: existing coach marks (sidebar + a few anchors).
- **Long**: walk every primary nav tab; for each, switch tab/route then spotlight in-page features (`data-tour` on KPIs, upload, sync, etc.).
- Early **Skip for now** on onboarding also marks tour done (no surprise tour after skip), except tester email.

## Tester

```ts
email?.toLowerCase() === "ali@the-leadlab.com"
```

→ `shouldForceProductGuides(email)` true → auto-show onboarding/tour even if localStorage says done.

## Out of scope

Open Banking; promoting Ali lab into `/app`.
