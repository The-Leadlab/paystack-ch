# Personal + Business onboarding — Super Prompt

## Goal

Two **separate** Apollo-style first-run wizards with **Skip for now** on every step.

## Personal (`/personal`)

Steps: welcome → money goal → Google Drive (optional) → invite (optional) → upload statement (optional).  
Flags: `paystack-personal-onboarding-done` (+ optional preferences JSON).

## Business (`/app`)

Steps: welcome → restaurant/client ready → Google Drive → first session hint → done.  
Reuse existing client pick when needed. Flag: `paystack-business-onboarding-done`.

## Shared

Fullscreen-ish dark step shell, primary CTA, Skip. Never mix personal imports into business Revenue.
