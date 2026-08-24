# Tour buttons, language chrome & Google Drive trust — Super Prompt

Use when fixing **product tour Next/Skip**, replacing **theme FAB with language**, or the Google **“unverified app” / don’t trust this platform** OAuth screen.

## Goals

1. Tour **Suivant / Next**, **Retour**, **Passer le tutoriel** always work for new users.
2. On `/app` and `/personal`, floating chrome and tour header show **language (EN/FR)**, not Clair/Sombre theme.
3. Before Drive connect, users see clear copy that Google’s unverified warning is expected; ops path to remove the warning permanently.

## Tour click reliability

| Rule | Detail |
|------|--------|
| Z-index | `ProductTourOverlay` root **`z-[120]`** (above ThemeToggle/`Language` FAB `z-100` and onboarding `z-110`) |
| Backdrop | Dim layer is **`pointer-events-none`** — do **not** skip on backdrop click (that ate Next taps) |
| Popover | `pointer-events-auto` + `stopPropagation` on click/pointerdown |
| Buttons | `preventDefault` + `stopPropagation` + `touch-manipulation` |
| Skip persistence | `useProductTour` **always** respects `readTourDone` (even `force` tester). Restart only via sidebar / `requestProductTour` |

Files: `client/src/components/product-tour/ProductTourOverlay.tsx`, `useProductTour.ts`.

## Language instead of theme (app shell)

| Surface | Control |
|---------|---------|
| Tour popover header | `OnboardingLanguageToggle` (not `OnboardingThemeToggle`) |
| Floating FAB on `/app`, `/personal` | Language EN↔FR (`ThemeToggle.tsx` app-shell branch) |
| Marketing / auth pages | Keep theme FAB (light/dark) |
| Onboarding welcome shell | May keep theme toggle in header |

`OnboardingLanguageToggle` lives in `OnboardingStepShell.tsx`.

## Google Drive “we don’t trust this app”

That screen is **Google OAuth consent**, not a Paystack bug. While the Cloud project is in **Testing** or **unverified**, Google shows the warning.

### In-app (shipped)

- Billing Drive panel: `t("driveUnverifiedWarning")` above Connect
- Business onboarding Drive step: `t("bizOnboardDriveUnverified")`
- Error helper: `oauth_denied` mentions Advanced → Go to Paystack.ch

### Ops (removes the warning for everyone)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **OAuth consent screen**
2. App name **Paystack.ch**, support email, logo, homepage `https://www.paystack.ch`, privacy + terms URLs
3. While **Testing**: add every beta Google account under **Test users**
4. Submit **Verification** (sensitive scopes: `drive.file` / `drive.readonly` need review)
5. Confirm authorized redirect: `https://paystack.ch/api/oauth/google/callback` (and www if used)
6. Env on Vercel: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`

Code cannot silence Google’s interstitial without verification / test-user allowlisting.

## Checklist

- [ ] Long tour: Next advances; Skip dismisses and stays dismissed until Restart tour
- [ ] Tour header shows 🌐 FR/EN, not Clair
- [ ] Floating button on `/app` is language, not Clair
- [ ] Drive connect panel shows unverified warning in FR and EN
- [ ] Test users listed in Google Console (or verification submitted)

## Related

- `docs/FEATURE_TOUR_SUPER_PROMPT.md`
- `docs/ONBOARDING_I18N_BUTTONS_SUPER_PROMPT.md`
- `docs/PERSONAL_E2E_DRIVE_SUPER_PROMPT.md`
