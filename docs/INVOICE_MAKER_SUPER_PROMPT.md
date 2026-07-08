# Invoice Maker — Super Prompt

Port the **Invoice Maker** from [The-Leadlab/LL](https://github.com/The-Leadlab/LL) into the production business app at `/app` as a **new main tab** (same level as Revenue, Reports, Documents). Match the **Business App V3** UI/UX (`ba-v3`, `ba-panel`, `ba-verify-field`, etc.) while preserving LL feature behavior.

## Source reference (LL repo)

| Item | Location |
|------|----------|
| Original UI | `frontend/src/pages/Admin/InvoiceMaker.tsx` |
| Behavior | Client-side only: form + preview + local save + mock PDF download + email send |

LL uses a backend email API; Paystack uses **`mailto:`** with a pre-filled subject/body instead. LL uses a leads API for quick client select; Paystack uses **document issuers** from `useDocuments()`.

## Architecture (Paystack)

| Area | Files |
|------|--------|
| Tab shell | `client/src/cafe/components/RestaurantDashboard.tsx` |
| Nav type | `client/src/cafe/components/BusinessSidebarNav.tsx` — add `'invoices'` to `BusinessTab` |
| Panel UI | `client/src/cafe/components/InvoiceMakerPanel.tsx` |
| Types | `client/src/cafe/types/invoice.ts` |
| Storage | `client/src/cafe/lib/invoiceStorage.ts` — `localStorage` keyed by `paystack_invoices_${userId}` |
| i18n | `client/src/cafe/i18n/dashboardTranslations.ts` — keys prefixed `inv*` + `invoiceMakerTab` |

## Tab wiring

1. Add nav item after **Revenue**: `{ id: 'invoices', labelKey: 'invoiceMakerTab', icon: FilePenLine }`
2. Render: `{activeTab === 'invoices' && <InvoiceMakerPanel />}`
3. Include in desktop sidebar (`BusinessSidebarNav`) and mobile bottom tab bar
4. No subscription gate (always visible, like Reports/Documents)

## Feature parity (from LL)

- Invoice header: number (regenerate), date, due date, status, payment terms
- Company block (defaults: Paystack.ch, Switzerland, 8.1% VAT, CHF)
- Client block + quick select from known suppliers/issuers
- Line items: description, qty, unit price, computed total; add/remove rows
- Notes + terms & conditions
- Sidebar: financial summary (subtotal, tax, discount, total), quick actions, status panel
- **Preview mode**: printable white layout with Paystack logo (`BRAND_LOGO_SRC`)
- **Save draft** → `upsertInvoice()` in localStorage
- **Download PDF** → JSON blob download (same mock behavior as LL)
- **Send** → `mailto:` with invoice summary (requires client email)
- **Saved invoices table**: edit / view / preview

## V3 styling rules

- Page header: `ba-page-header`
- Sections: `ba-panel` with panel title row
- Inputs: `ba-verify-field`
- Buttons: primary gold / secondary patterns used elsewhere in `/app`
- Table: `ba-doc-table` for saved invoices list
- Status badges: `ba-status-pill--*` mapped to draft/sent/paid/overdue
- Preview pane: white `#fff` card inside dark shell (print-friendly)

## i18n

Add EN + FR for all `inv*` keys and `invoiceMakerTab`. Reuse `dpColActions` for the saved list actions column.

## Out of scope (unless explicitly requested)

- Firestore sync / multi-device invoice storage
- Real PDF generation (e.g. jsPDF, server-side)
- Stripe invoicing integration
- Promotion to `/ali` lab
- Wiring outbound invoices into finance ledger automatically

## Verification checklist

1. `/app` → **Invoices** tab appears in sidebar and mobile nav
2. Create invoice with line items → totals recalculate (8.1% VAT)
3. Save draft → appears in saved list; reload page → data persists per user
4. Preview → white printable layout; back to edit works
5. Download → `.json` file with invoice payload
6. Send → opens mail client when client email is set
7. Quick select supplier prefills client fields from document issuers
8. ENG/FR toggle translates all invoice labels
