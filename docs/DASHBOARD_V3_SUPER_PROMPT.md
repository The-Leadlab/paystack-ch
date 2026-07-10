# Dashboard V3 UI — Super Prompt

Match the **dark charcoal** business dashboard mockup on `/app` (Dashboard, Revenue, Reports, Documents, Billing).

## Design tokens (source of truth)

| Token | Dark value | Use |
|-------|------------|-----|
| Sidebar | `#1a1d21` | Left nav (`bg-cdlp-black`) |
| Canvas | `#1e2228` | Main content (`bg-cdlp-dark`, `--ba-canvas`) |
| Cards | `#2d3238` | KPI, panels (`--ba-surface`) |
| Border | `#3d4450` | Dividers |
| Muted text | `#9aa0a6` | Labels |
| CTA accent | `#f25f5c` | Connect, upgrade buttons (`cdlp-gold` in dark) |
| Success green | `#34d399` | Income, balance |
| Error red | `#f87171` | Expenses, master reset |
| **Font** | **Inter** 400–900 | All `/app` UI under `.cafe-shell` + `.ba-v3` |

## Architecture

| Area | Files |
|------|--------|
| V3 scoped CSS | `client/src/cafe/businessApp.css` (`.ba-v3`) |
| Shell cdlp remap (dark) | `client/src/index.css` → `.cafe-shell.cafe-theme-dark` |
| Layout + tabs | `client/src/cafe/components/RestaurantDashboard.tsx` |
| Sidebar nav | `client/src/cafe/components/BusinessSidebarNav.tsx` |
| KPI cards | `client/src/cafe/components/BusinessKpiCard.tsx` |
| Upload + doc table | `client/src/cafe/components/DocumentProcessor.tsx` |
| Brand logo | `client/src/const/branding.ts` |

## Document table (mockup)

Scoped under `.ba-v3 .ba-doc-table` in `businessApp.css` + `DocumentProcessor.tsx`:

| Element | Style |
|---------|--------|
| Layout | `border-spacing` row gaps — no vertical grid lines |
| Header | Transparent bg, gray uppercase labels (`0.12em` tracking) |
| Rows | `#1e2126` elevated surface, `0.5rem` radius per row |
| Values | White text; amounts/VAT end with ` CHF` (`de-CH`) |
| TYPE | Borderless select (looks like plain white label) |
| Status | Pill badges: green **COMPLETED**, amber **VERIFICATION CENTER** |
| Actions | Circular `ba-doc-action-btn` (edit / view / delete) |

## Layout checklist (mockup)

- [x] 4 KPI row: Income (green bar), Expenses (red bar), Payroll (gray), Balance
- [x] VAT row: 3 cards with hint subtext
- [x] Large white uppercase page title + live clock top-right
- [x] Dashed upload zone + centered white **START PROCESSING**
- [x] Documents table: spaced rows, pills, round action icons
- [x] Sidebar: uppercase nav, white left border on active tab
- [x] Charcoal palette (not burgundy `#160f12`)

## Do / don't

- **Do** scope dashboard changes under `.ba-v3` or `.cafe-shell.cafe-theme-dark` cdlp overrides.
- **Do** keep red/green for **data** (KPI values, status pills), white for **section titles**.
- **Don't** use `text-cdlp-gold` for section headings on dashboard — reserve `#e8423f` for CTAs only.
- **Don't** change `/ali` or marketing `/` palettes in the same pass unless explicitly requested.

## Google Drive (Billing tab)

See `shared/googleDriveErrors.ts` + `docs/REPORT_EMAIL_SUPER_PROMPT.md` Google Drive section.

**Production connect requires:** see `docs/GOOGLE_DRIVE_FIREBASE_SETUP.md`

On failure, URL includes `?googleDrive=error&googleDriveReason=firebase_admin|...` — toast shows actionable message.

## Verification

1. `/app` dark theme: charcoal shell, white `DASHBOARD` title, green/red KPIs
2. Upload zone + documents table match card surface `#20232b`
3. Billing → Connect Google Drive → success toast or specific error reason
4. Light theme still readable (`cafe-theme-light` overrides in `businessApp.css`)
