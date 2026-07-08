# Business App V3 Design — Super Prompt

Apply the **Refined Dashboard V3** visual system to the production business app at `/app`. Scope is UI/UX only: preserve all existing data flows, Firestore writes, document AI processing, subscription gates, and session logic.

## Design reference

Two mockups define the target:

1. **Dashboard** — dark sidebar with nav (Dashboard, Revenue, Reports, Documents, Billing), user email, ENG/FR toggle, Master Reset, New Session, recent sessions; main area with KPI cards (Income, Expenses, Payroll, Balance + VAT row), upload zone, document table with status pills and row actions.
2. **Verification Center** — split pane: document preview left, verification form right with OPEN PDF + blue **APPROVE**, issuer/amount/date/VAT/net/category fields, Swiss TVA breakdown tables below.

## Architecture

| Area | Files |
|------|--------|
| Shell + tabs | `client/src/cafe/components/RestaurantDashboard.tsx` |
| V3 tokens + components | `client/src/cafe/businessApp.css`, `BusinessKpiCard.tsx`, `BusinessSidebarNav.tsx` |
| Upload + table + verification | `client/src/cafe/components/DocumentProcessor.tsx` |
| Billing header | `client/src/cafe/components/BillingPlanPanel.tsx` |
| i18n | `client/src/cafe/i18n/dashboardTranslations.ts` |

Root wrapper: `.ba-v3` on `RestaurantDashboard` outer div. Import `businessApp.css` there only.

## Visual tokens (`.ba-v3`)

- Background `#121418`, surfaces `#20232b` / `#2a2e38`, border `#3a3f4b`
- Accent blue `#2563eb` (APPROVE), green/red for KPI tones
- Uppercase labels, Swiss CHF formatting with apostrophe thousands separators (existing `useChfLocale`)

## Sidebar

- Desktop: logo → `BusinessSidebarNav` → email + language → Master Reset → New Session → scrollable recent sessions → Personal finances + Logout footer
- Mobile: hamburger opens same sidebar; include `BusinessSidebarNav` + Master Reset at top; bottom tab bar remains for quick switching
- Active nav: white left border + elevated background (`data-active="true"`)

## Dashboard tab

- Page title **DASHBOARD** + session timestamp
- Four KPI cards via `BusinessKpiCard` with bottom progress bars
- Three VAT KPI cards with hint subtext
- `DocumentProcessor` upload zone (dashed `ba-upload-zone`, white **START PROCESSING**)
- Document table: dark header (`ba-doc-table`), status pills, edit opens verification row

## Verification Center

- Inline expand in document table (`VerificationHub`)
- Layout: `ba-verify-shell` → preview (`NeuralLog`) + form pane
- Header: title, OPEN PDF, blue **APPROVE** (`ba-btn-approve`) — single save action; no duplicate sticky save bar
- Main fields use `ba-verify-field` (issuer, total, date, VAT, net, category)
- Keep Swiss TVA editor, payslip/bank blocks, sub-invoice flows unchanged functionally

## Status pills

| State | Class |
|-------|--------|
| Completed | `ba-status-pill--completed` |
| Verification open | `ba-status-pill--verify` |
| Error | `ba-status-pill--error` |
| Processing / skipped | `ba-status-pill--pending` |

## Other tabs

- Reports, Documents, Billing: `ba-page-header` title + existing content in `ba-panel` where appropriate
- Revenue (`POSManager`): inherits `.ba-v3` parent styles; do not break POS gating

## i18n keys added

- `dashRecentSessions`, `dpApprove`, `dpColActions` (EN + FR)

## Out of scope

- Do not promote changes to `/ali` lab unless explicitly requested
- Do not change Firestore schema, Gemini prompts, or Stripe billing logic
- Personal finances route (`/app/personal/*`) unchanged unless asked

## Verification checklist

- [ ] All sidebar nav links switch tabs
- [ ] Mobile bottom nav + sidebar nav both work
- [ ] Upload → process → completed row → edit/expand verification → APPROVE updates dashboard totals
- [ ] Delete, retry, reattach on error rows still work
- [ ] Master Reset, New Session, session switch, language toggle
- [ ] Billing tab opens from nav and upgrade prompts
- [ ] `pnpm build` succeeds
