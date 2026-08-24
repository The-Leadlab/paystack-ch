# Personal + Business onboarding — Super Prompt

## Goal

Two **separate** Apollo-style first-run wizards with **Skip for now** on every step.

**Language:** all copy via `t()` — see `docs/ONBOARDING_I18N_BUTTONS_SUPER_PROMPT.md`. Never hardcode English in wizard JSX.

## Personal (`/personal`)

Steps: welcome → money goal → Google Drive (optional) → invite (optional) → upload statement (optional) → tour length.  
Flags: `paystack-personal-onboarding-done` (+ optional preferences JSON).

## Business (`/app`)

Steps: welcome → restaurant/client ready → Google Drive → first session hint → tour length.  
Reuse existing client pick when needed. Flag: `paystack-business-onboarding-done`.

## Shared

Fullscreen shell (`z-[110]`), primary CTA, Skip. Never mix personal imports into business Revenue.
