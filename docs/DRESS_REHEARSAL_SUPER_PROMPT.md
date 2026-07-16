# Dress Rehearsal Fixes — Super Prompt

Source: PayStack dress rehearsal notes (2026-07-16). Owner: **Ali Attia**.  
Out of scope: William’s Drive invoices subfolder, E2E testing, UX screen recording, revenue brainstorm.

## Goals

Ship every Ali-owned decision from the dress rehearsal into `/app` (and related APIs): clearer VAT UX, correct invoice vs item detection, invoice branding, report polish + scheduling, revenue parity, regional tax settings, and cleanup of test accounts / billing copy.

## Decisions → implementation

| Decision / next step | Implementation |
|----------------------|----------------|
| Remove VAT effective mean (~1.96%) | Remove rate hints from Dashboard VAT KPI cards (`vatFromCustomersHint` / `vatOnPurchasesHint` % display). Keep VAT **amounts**. |
| Remove % from Purchases / Customers views | Same VAT cards — show amounts only, no “% of sales” / “% effective”. |
| Cancel Stripe Portal → Cancel Subscription | Rename i18n `billingCancelCta` (EN+FR); behavior still opens Customer Portal. |
| Remove Team slots UI | Remove Team slots row from Billing plan summary. Keep entitlement enforcement in employee add flow. |
| Items ≠ invoices in detection | **Never** promote `lineItems` into `subDocuments`. `subDocuments` = distinct invoices/receipts only. Line items stay line items. Multi-invoice PDFs still use `subDocuments` and label “N invoices detected”. Single invoice with many lines: one invoice, N items. |
| Justify T&Cs on invoice PDF | `invoicePdf.ts` — full justification; extend toward page bottom. |
| User logo on invoices | Invoice Maker only: upload → store (Firebase Storage + user/invoice field) → preview + PDF. **Not** Stripe Checkout/Portal branding. |
| Revenue totals on Revenue tab | Surface dashboard income / ledger totals on Revenue (`POSManager`) so the tab is not bare. |
| Verify 7.7% VAT | Audit Swiss rate constants vs current 8.1% / 2.6% / 0%; fix wrong hardcodes; document rates in tax settings. |
| Report design + de-rainbow | `reportExportService.ts` + email PDF: brand palette (charcoal / red / cream / gold), drop blue/orange/purple metric colors. |
| Reports columns | Transaction tables: vendor, date, category, account, amount, VAT, description. |
| Custom date range downloads | Reports UI: date-from / date-to → filter export + email payloads. |
| Automated recurring email reports | Firestore schedule prefs + cron/API; cadence 7 / 14 / 30 days + anchor date; Resend; Business+ gate; ~3k/mo soft awareness. |
| Tax / regional settings | User profile: region (CH / UK / off) + default VAT codes; drive invoice defaults and report labels. |
| Vendor on invoice/document details | Expose clear Vendor field (map from `issuer` where appropriate); persist on ledger/report rows when available. |
| Delete test-mode accounts | Ops: remove Stripe/Firebase test customers not on key-staff allowlist. |

## Architecture map

| Area | Files |
|------|--------|
| Detection / normalize | `client/src/cafe/services/geminiService.ts` (`normalizeMultiInvoiceData`) |
| Doc UI labels | `DocumentProcessor.tsx`, `documentDisplayI18n.ts`, `dashboardTranslations.ts` |
| Dashboard VAT KPIs | `RestaurantDashboard.tsx`, `LanguageContext.tsx` |
| Billing copy / team slots | `BillingPlanPanel.tsx`, `LanguageContext.tsx` |
| Invoice PDF + maker | `invoicePdf.ts`, `InvoiceMakerPanel.tsx`, `types/invoice.ts`, `invoiceStorage.ts` |
| Revenue | `POSManager.tsx`, `RestaurantDashboard.tsx` |
| Reports export / UI | `reportExportService.ts`, Reports section in `RestaurantDashboard.tsx` |
| Report email (manual) | `api/reports/email.ts`, `lib/reportEmail*.ts`, `reportEmailClient.ts` |
| Scheduled reports (new) | Firestore `users/{uid}.reportSchedule` + `api/reports/cron.ts` (or Vercel cron) |
| Tax settings (new) | User Firestore fields + Billing/Settings UI |
| Brand tokens | `shared/brandAssets.ts`, `businessApp.css` |

## Detection rules (critical)

1. **Invoice** = one supplier document / receipt / payslip block (`subDocuments` entry or single top-level doc).
2. **Item** = line within an invoice (`lineItems`).
3. Do **not** invent `subDocuments` from expense `lineItems` when the model returns ≤1 sub-invoice.
4. Multi-invoice PDF → multiple `subDocuments` → issuer may read “N invoices detected”.
5. One invoice, many products → `subDocuments` empty or length 1; items listed under that invoice only.

## Invoice logo

1. Upload control in Invoice Maker company block.
2. Prefer Firebase Storage path `users/{uid}/branding/logo.*`; fallback local/data URL for preview-only if Storage unavailable.
3. Preview + PDF must render the logo (extend PDF builder beyond text-only if needed).
4. Size clamp so layout stays professional.

## Scheduled report email

1. UI on Reports: enable toggle, cadence (7 / 14 / 30), anchor date, optional locale.
2. Persist under `users/{uid}.reportSchedule`.
3. Cron (Vercel) daily: find due users, call same Resend pipeline as manual email, update `lastSentAt`.
4. Respect Business+ entitlement; skip if missing email or bad standing.

## Tax settings MVP

| Region | Default rates |
|--------|----------------|
| CH | 8.1% / 2.6% / 0% (and legacy 7.7% only if still printed on old receipts) |
| UK | 20% / 5% / 0% |
| Off | Hide VAT-centric UI where safe; rates 0 |

## Reports aesthetic

- Primary: Paystack red `#E8423F`, charcoal `#2B2B2B`, cream `#FFF5F4`, muted gold accent.
- Positive/negative: green / red only for money sign — not rainbow sections.
- PDF must look verifiable: clear period, totals, column headers, brand mark.

## Out of scope

- Stripe Customer Portal / Checkout logo (Dashboard config only).
- William: Drive invoices subfolder, E2E batch test, screen recording, revenue feature brainstorm.
- Promoting Ali Lab features into `/app`.

## Verification checklist

1. Dashboard VAT cards show CHF amounts without % effective hints.
2. Upload a single invoice with many line items → one invoice, items listed; not N fake invoices.
3. Upload a multi-invoice PDF → N invoices detected (not “items”).
4. Billing: “Cancel subscription”; no Team slots row.
5. Invoice Maker: upload logo → visible in preview + downloaded PDF; T&Cs justified.
6. Revenue tab shows income totals aligned with dashboard.
7. Reports: custom date range export; columns include vendor + VAT; no rainbow palette.
8. Schedule report email → prefs saved → cron sends on cadence.
9. Tax settings: switch CH/UK/off affects invoice default VAT presets.
10. Test-mode non-staff accounts removed (ops allowlist confirmed).

## Implementation status (2026-07-16)

| Item | Status |
|------|--------|
| VAT % hints removed | Done |
| Cancel subscription rename | Done |
| Team slots row removed from Billing | Done |
| Items vs invoices detection | Done (`normalizeMultiInvoiceData` no longer promotes line items) |
| Invoice logo + justified T&Cs | Done |
| Revenue ledger KPIs | Done (8.1% VAT for estimates) |
| Report rebrand + vendor/VAT columns + ledger table | Done |
| Custom date range | Already present; retained |
| Scheduled report emails | Done (`/api/reports/schedule` + cron) |
| Tax region settings | Done (CH/UK/off) |
| Test account deletion | Ops doc only — confirm allowlist then delete via `/admin` |

See also `docs/TEST_ACCOUNT_CLEANUP.md`.
