# Dashboard V3 UI — Super Prompt

Match the **dark charcoal** business dashboard mockup on `/app` (Dashboard, Revenue, Reports, Documents, Billing).

## Design tokens (source of truth)

| Token | Dark value | Use |
|-------|------------|-----|
| `--ba-canvas` / `bg-cdlp-dark` | `#121418` | Main content background |
| `--ba-surface` / `bg-cdlp-card` | `#20232b` | KPI cards, panels |
| Sidebar `bg-cdlp-black` | `#1e2128` | Left nav |
| `--ba-border` / `border-cdlp-border` | `#3a3f4b` | Borders |
| `--ba-muted` / `text-cdlp-muted` | `#9ca3af` | Labels |
| `--ba-accent-green` | `#22c55e` | Income, positive balance |
| `--ba-accent-red` | `#ef4444` | Expenses, negative balance |
| Brand CTA red | `#e8423f` | Buttons (MASTER RESET, Connect) |
| Page title | `#ffffff`, **Sora** 2.25rem desktop | `DASHBOARD` header |

**Fonts:** `Sora` (display/sans) via `--font-display`; amounts use tabular nums; clock uses `JetBrains Mono`.

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

## Layout checklist (mockup)

- [x] 4 KPI row: Income (green), Expenses (red), Payroll (purple), Balance (green/red)
- [x] VAT row: 3 cards with hint subtext
- [x] Large white uppercase page title + live clock top-right
- [x] Dashed upload zone (`ba-upload-zone`)
- [x] Documents table + status pills (`ba-status-pill--*`)
- [x] Sidebar: uppercase nav, white left border on active tab
- [x] Charcoal palette (not burgundy `#160f12`)

## Do / don't

- **Do** scope dashboard changes under `.ba-v3` or `.cafe-shell.cafe-theme-dark` cdlp overrides.
- **Do** keep red/green for **data** (KPI values, status pills), white for **section titles**.
- **Don't** use `text-cdlp-gold` for section headings on dashboard — reserve `#e8423f` for CTAs only.
- **Don't** change `/ali` or marketing `/` palettes in the same pass unless explicitly requested.

## Google Drive (Billing tab)

See `shared/googleDriveErrors.ts` + `docs/REPORT_EMAIL_SUPER_PROMPT.md` Google Drive section.

**Production connect requires:**
- `GOOGLE_DRIVE_CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `STATE_SECRET`
- **`FIREBASE_SERVICE_ACCOUNT_JSON`** (callback stores tokens in Firestore)
- Redirect URI in Google Cloud Console: `https://paystack.ch/api/oauth/google/callback`

On failure, URL includes `?googleDrive=error&googleDriveReason=firebase_admin|...` — toast shows actionable message.

## Verification

1. `/app` dark theme: charcoal shell, white `DASHBOARD` title, green/red KPIs
2. Upload zone + documents table match card surface `#20232b`
3. Billing → Connect Google Drive → success toast or specific error reason
4. Light theme still readable (`cafe-theme-light` overrides in `businessApp.css`)
