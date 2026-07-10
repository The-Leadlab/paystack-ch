# Report Email (Resend) — Super Prompt

Email **financial reports as PDF** from `/app` → **Reports** tab. Uses [Resend](https://resend.com) server-side; no client email API keys.

## Cadences

| Button | Period |
|--------|--------|
| Email weekly | Last 7 days |
| Email biweekly | Last 14 days |
| Email monthly | Current calendar month |
| Email annual | Current calendar year |

Recipient is the **signed-in Firebase user's email** (from ID token).

## Architecture

| Area | Files |
|------|--------|
| Period math | `shared/reportPeriod.ts` |
| Server PDF | `lib/reportEmailPdf.ts` |
| Resend HTTP | `lib/resendReports.ts` |
| API | `api/reports/email.ts` |
| Client | `client/src/cafe/lib/reportEmailClient.ts` |
| UI | `RestaurantDashboard.tsx` → `ReportsPlaceholder` |

## Env (Vercel)

- `RESEND_API_KEY` — Resend API key
- `REPORT_EMAIL_FROM` — verified sender, e.g. `Paystack Reports <reports@paystack.ch>`
- Firebase auth: `FIREBASE_WEB_API_KEY` or Admin SDK JSON (same as other APIs)

## Plan gating

Same as PDF download: **Business+** (`advancedAnalyticsAndReports`).

## Google Drive (merged)

OAuth + per-user Drive sync lives on **Billing** tab (`GoogleDriveConnectPanel`). See `.env.example` `GOOGLE_DRIVE_*` vars.

## Verification

1. Set `RESEND_API_KEY` + verified `REPORT_EMAIL_FROM` on Vercel
2. `/app` → Reports → click **Email weekly** (Business plan)
3. Inbox receives PDF attachment
4. Billing → connect Google Drive → upload document → appears in Drive folder
