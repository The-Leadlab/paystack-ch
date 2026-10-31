# Platform UI/UX Across Devices — Super Prompt

Act as a **senior product designer + front-end implementer**. Make Paystack.ch feel intentional on **phone, tablet, and desktop**—not a desktop dashboard squashed onto small screens, and not a phone app that wastes tablet width.

**Surfaces:** `/app` + `/admin-uk` (all tabs), `/personal` (parity), landing `/` (tour/nav density only — not a marketing redesign).  
**Out of scope:** `/ali` lab promotion, Capacitor/native wrap, Open Banking, inventing a new brand palette, HMRC logic beyond layout wrap.

Related: `docs/MOBILE_APP_UX_SUPER_PROMPT.md`, `docs/BUSINESS_APP_V3_DESIGN_SUPER_PROMPT.md`, `docs/PERSONAL_BUSINESS_VISUAL_PARITY_SUPER_PROMPT.md`.

---

## Role & mindset

You are designing for a Swiss café / restaurant owner who switches between kitchen phone, counter iPad, and office laptop:

- One thumb on phone; two hands on tablet; mouse on desktop.
- Numbers readable at arm’s length; CTAs ≥44×44px; safe-area respected.
- Stay inside Paystack **V3 tokens** (charcoal / cream, accent blue APPROVE, Inter). Personal uses `--pp-*` mapped toward V3. No purple-glow fintech clichés.

---

## Agent skill workflow (mandatory before large UI batches)

1. **Visualize** — breakpoint map (phone / tablet / desktop).
2. **Canvas** — inventory overflowing tables vs card-ready lists.
3. **Then code** — CSS under `.ba-v3` / `.personal-plan-shell` + targeted React. Prefer tokens over one-off hex.

---

## Breakpoints (locked)

| Tier | Width | Shell | Content |
|------|-------|--------|---------|
| **Phone** | `< 768px` | Top bar + ≤5 bottom tabs + More sheet | Card lists; KPI snap; sticky APPROVE |
| **Tablet** | `768–1023px` | Rail/collapsed sidebar by default | 2-col KPIs; cards where tables overflow |
| **Desktop** | `≥ 1024px` | Full sidebar | Tables OK |

Tailwind: phone = below `md`; tablet = `md`–below `lg`; desktop = `lg+`.

---

## Shared design rules

| Rule | Spec |
|------|------|
| Dense tables | Cards ≤1023 via `.ba-card-list`; tables `.ba-table-desktop-only` |
| Chips / filters | Cap visible rows; overflow → More filters sheet on phone |
| Buttons | Min height 44px on phone; no `text-[8px]`/`[9px]` as primary labels |
| Toolbars | Stack or collapse under `md`; one primary CTA per section |
| Theme | Light + dark; EN + FR for new strings |

---

## Full sweep checklist (Wave 1–3)

### Wave 1 — P0

- [x] **Verification** (`DocumentProcessor.tsx`) — stack VAT tables on phone; enlarge controls; sticky APPROVE
- [x] **Inventory** (`InventoryPanel.tsx`) — product/movement `ba-card-list` ≤1023
- [x] **Personal nav** — ≤5 bottom slots; tablet rail + 2-col KPIs until `lg`
- [x] **Personal Investments** — card rows on phone

### Wave 2 — P1

- [x] **Dashboard** IncomeExpense — card rows; 44px actions
- [x] **Revenue** (`POSManager.tsx`) — collapse chip sprawl on phone/tablet
- [x] **Expenses** (`ExpensesManager.tsx`) — same toolbar pattern
- [x] **Reports** — mobile filter stack; UK controls wrap; summary 2-col until `lg`
- [x] **Invoices** — phone editor stacked; line items as cards
- [x] **Sessions / sidebar** — session actions ≥44px
- [x] **Personal** Budget / Bills / Overview — collapse pill rows; tablet KPIs

### Wave 3 — P2

- [x] **Billing** — single-column plans on phone
- [x] **Documents** toolbar wrap-safe
- [x] **Employee** slide-over V3 + i18n
- [x] **Landing** PlatformTour — horizontal-scroll pills; Personal tab if strings exist
- [x] **Personal** Settings / Savings / Forecast — light overflow fixes

---

## File map

| Area | Files |
|------|--------|
| Shell | `client/src/cafe/components/RestaurantDashboard.tsx` |
| Tokens | `client/src/cafe/businessApp.css` |
| Mobile chrome | `MobileTabBar.tsx`, `MobileMoreSheet.tsx`, `MobileMoneySegment.tsx` |
| Docs / verify | `DocumentProcessor.tsx`, `DocumentsLibraryTab.tsx` |
| Money | `RevenueLedgerTable.tsx`, `ExpensesManager.tsx`, `POSManager.tsx` |
| Inventory | `InventoryPanel.tsx` |
| Invoices | `InvoiceMakerPanel.tsx` |
| Billing | `BillingPlanPanel.tsx` |
| UK banner | `client/src/pages/AdminUkPage.tsx` |
| Personal | `personalPlan.css`, `PersonalPlanShell.tsx`, `personalPlanNav.ts`, feature panels |
| Landing | `PlatformTourSection.tsx` |
| i18n | `dashboardTranslations.ts` |

---

## Acceptance checklist

- [x] Phone (~390): ≤5 tabs; no 8-col tables; Capture reachable; APPROVE sticky — patterns shipped (`ba-card-list`/`pp-card-list`, `ba-toolbar-scroll`, touch ≥44px)
- [x] Tablet (~768–834): rail sidebar; KPIs 2-col; UK banner compact — CSS + shell defaults
- [x] Desktop (≥1280): full sidebar + tables — `ba-table-desktop-only` / `pp-table-desktop-only`
- [x] Light + dark; EN + FR; no Firestore / Gemini / Stripe logic changes — UI/CSS/i18n only (spot-check EN/FR keys for Employee + PlatformTour V6)

---

## Verify

Manual: `/app`, `/admin-uk`, `/personal` at ~390 / ~768–834 / ≥1280 — every tab. Spot-check light + dark.
