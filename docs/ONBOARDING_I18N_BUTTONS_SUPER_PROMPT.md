# Onboarding + product tour i18n — Super Prompt

Use this whenever changing **Business** (`/app`) or **Personal** (`/personal`) first-run wizards, Skip/Continue, or the product tour that follows.

## Goal

If the UI language is **French**, every onboarding step, Skip/Continue, Drive copy, tour length choice, and product-tour step must be French. Same for **English**. No hardcoded English strings in wizard JSX.

## Source of truth

| Surface | Component | Strings |
|---------|-----------|---------|
| Shared shell | `client/src/components/onboarding/OnboardingStepShell.tsx` | `t("onboardingSkip")`; z-index **110** (above ThemeToggle z-100) |
| Business wizard | `client/src/cafe/components/BusinessOnboardingWizard.tsx` | `bizOnboard*` + `onboarding*` via `t()` |
| Personal wizard | `client/src/ali-lab/personal-plan/components/PersonalOnboardingWizard.tsx` | `perOnboard*` + `onboarding*` via `t()` |
| Tour chrome + steps | `client/src/cafe/i18n/tourTranslations.ts` (`tourEn` / `tourFr`) merged in `LanguageContext` |
| Tour overlay | `client/src/components/product-tour/ProductTourOverlay.tsx` | already `t(step.titleKey)` / `t(step.bodyKey)` |

Language comes from `paystack_language` (`LanguageContext`). Default is French unless storage is explicitly `en`.

## Button rules (must work)

1. **Continue** advances the step (`setStep`); **Skip for now** either finishes (`finish("skip")`) or skips optional steps.
2. Onboarding shell is `fixed inset-0 z-[110] pointer-events-auto` so global ThemeToggle / other chrome cannot steal taps.
3. Do **not** open `PlanTestPickerModal` while `showBusinessOnboarding` is true (`RestaurantDashboard`).
4. Primary/Skip handlers use `preventDefault` + `stopPropagation` so parent handlers cannot swallow the click.
5. Tour choice step: primary stays disabled until a length card is selected (`short` / `long` / `skip`).

## Checklist

- [ ] Grep wizards for hardcoded `Welcome to`, `Continue`, `Skip for now` — should be zero
- [ ] FR account (`paystack_language=fr` or default): welcome title is French; Skip is « Passer pour l’instant »
- [ ] EN account: English welcome + « Skip for now »
- [ ] Continue advances 0 → 1; Skip closes wizard (or marks tour skipped)
- [ ] After onboarding, tour overlay text matches the same language
- [ ] No plan-test dialog sitting on top of the welcome screen

## Related

- `docs/ONBOARDING_PERSONAL_BUSINESS_SUPER_PROMPT.md` — step structure
- `docs/BIZ_RAIL_TOUR_LENGTH_SUPER_PROMPT.md` — tour length choice
- `docs/I18N_SUPER_PROMPT.md` — broader i18n audit
