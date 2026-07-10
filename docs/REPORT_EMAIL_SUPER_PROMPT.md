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
| Branded HTML template | `lib/reportEmailTemplate.ts` |
| Brand tokens + logo URL | `shared/brandAssets.ts` |
| Server PDF | `lib/reportEmailPdf.ts` |
| Resend HTTP | `lib/resendReports.ts` |
| API | `api/reports/email.ts` |
| Client | `client/src/cafe/lib/reportEmailClient.ts` |
| UI | `RestaurantDashboard.tsx` → `ReportsPlaceholder` |
| Tests | `test/reportEmailTemplate.test.ts` |

## Branded email template

The HTML body is **not** plain `<p>` tags anymore. `buildReportEmailHtml()` renders a table-based layout (email-client safe) with:

| Element | Source |
|---------|--------|
| Logo | `{PUBLIC_APP_URL}/brand/paystack-mark-128.png` |
| Primary red | `#E8423F` (`BRAND_COLORS.red`) |
| Charcoal text | `#2B2B2B` |
| Cream page bg | `#FFF5F4` |
| Wordmark | `paystack` + red `.ch` |
| Summary row | Income / Expenses / Balance (CHF, `de-CH` formatting) |
| CTA button | Links to `{PUBLIC_APP_URL}/app` |

Locales: `en` and `fr` (matches report API `locale` body field).

**To change branding:** edit `shared/brandAssets.ts` (colors, logo path) and `lib/reportEmailTemplate.ts` (layout copy). Re-run `pnpm exec vitest run test/reportEmailTemplate.test.ts`.

**Logo in inbox:** must be served from the live site (`client/public/brand/paystack-mark-128.png`). Set `PUBLIC_APP_URL` on Vercel so the image URL resolves in Gmail/Outlook.

## Env (Vercel)

- `RESEND_API_KEY` — Resend API key
- `REPORT_EMAIL_FROM` — verified sender, e.g. `Paystack Reports <reports@paystack.ch>`
- `PUBLIC_APP_URL` — e.g. `https://paystack.ch` (logo + CTA links in email)
- Firebase auth: `FIREBASE_WEB_API_KEY` or Admin SDK JSON (same as other APIs)

## Plan gating

Same as PDF download: **Business+** (`advancedAnalyticsAndReports`).

## Google Drive

OAuth + per-user Drive sync lives on **Billing** tab (`GoogleDriveConnectPanel`). See `.env.example` `GOOGLE_DRIVE_*` vars.

### How it works (user flow)

1. User opens `/app` → **Billing** → **Connect Google Drive**.
2. Client calls `GET /api/oauth/google/start` (Firebase ID token) → redirect to Google consent.
3. Google redirects to `/api/oauth/google/callback` with `code` + signed `state`.
4. Server exchanges code for **refresh token**, creates a **“Paystack Documents”** folder in the user’s Drive (if none stored), saves `users/{uid}.googleDrive` in Firestore (`refreshToken`, `folderId`).
5. **Disconnect** revokes the token and clears Firestore.

### Auto-upload hook (server)

`saveDocumentToDrive(uid, file)` in `lib/googleServices.ts`:

- Refreshes access token from stored refresh token
- Uploads to the user’s folder via Drive API (`drive.file` scope — only files created by Paystack)
- Dedupes by `sourceId` (e.g. Firebase Storage path) in `uploadedDocuments`

**Note:** OAuth connect/disconnect is live. Wire `saveDocumentToDrive` from the document upload pipeline (`storageService.uploadDocument` or post-Gemini API) when enabling automatic Drive backup.

## Verification

1. Set `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, and `PUBLIC_APP_URL` on Vercel
2. `/app` → Reports → click **Email weekly** (Business plan)
3. Inbox shows branded HTML + PDF attachment (logo loads from your domain)
4. Billing → connect Google Drive → status shows connected
5. (After upload hook) upload document → copy appears in Drive folder **Paystack Documents**
