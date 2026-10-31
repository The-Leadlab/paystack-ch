# Manual UI Audit & Fix — Super Prompt

Act as a **senior product designer + front-end QA** who audits Paystack like a real restaurant owner on **phone, tablet, and desktop**, in **light and dark**, EN/FR. Do not trust prior “sweep complete” checklists — re-open every tab and fix what a human actually sees.

**Surfaces:** `/app`, `/admin-uk`, `/personal`, `/ali` (layout only), marketing `/` chrome only.  
**Out of scope:** HMRC logic, Open Banking, Capacitor, inventing a new brand, promoting `/ali` features.

Related: `docs/PLATFORM_UI_UX_DEVICES_SUPER_PROMPT.md`, `docs/BUSINESS_APP_V3_DESIGN_SUPER_PROMPT.md`, `docs/PERSONAL_BUSINESS_VISUAL_PARITY_SUPER_PROMPT.md`.

---

## Role & mindset

You are auditing production (`www.paystack.ch`) and local (`pnpm dev`) with the same eyes:

- Buttons that look orphaned, duplicated, or floating without a job are bugs.
- Black chrome on a **blue-dark** product is a bug.
- A missing theme control when language still has a FAB is a bug.
- Inventory/Reports “clean” is the bar — bring every tab to that density.

**Brand dark surface (locked):** V3 blue-charcoal `#1a1d23` / `#1e2126` / `#252a31` — **not** pure `#000` / warm black `#120d0f` / `#160f12` for nav, plan cards, or bottom bars.

---

## Agent workflow (mandatory)

1. **Screenshot as a user** — phone 390, tablet 768, desktop 1280; light + dark.
2. **List every issue** with tab + element + expected fix (no vague “polish”).
3. **Fix in tokens** — `.ba-v3` / `.personal-plan-shell` / `ThemeToggle` / shared chrome. Prefer CSS token remaps over one-off hex.
4. **Re-screenshot** the same views after each wave.
5. **Do not** mark done until dark-mode toggle is usable on `/app` and `/personal` without digging into Settings alone.

---

## P0 — User-reported (from live audit screenshots)

### 1. Dark mode toggle missing on `/app` (+ `/personal`)

**Cause:** `ThemeToggle` replaces itself with EN/FR language on `/app` and `/personal`, so theme disappears even though `ThemeProvider` is `switchable`.

**Fix:**

- Keep language accessible (sidebar ENG and/or FAB).
- Restore a **visible light/dark control** on those shells (stacked FAB cluster, or theme FAB + language in sidebar only — pick one coherent pattern).
- Desktop: theme reachable without opening Settings.
- Phone: both controls clear the bottom nav (`bottom` clearance already used for FAB).

Files: `client/src/components/ThemeToggle.tsx`, sidebar language/theme if needed.

### 2. Black chrome ≠ blue-dark theme

**Where:** personal bottom nav / sidebar foot; billing plan detail card; any `cdlp-dark` / `#120d0f` / `#160f12` panels that read as pure black next to V3 blue-dark.

**Fix:**

- Personal `--pp-surface-low` and mobile nav background → align to `#1a1d23` / elevated blue-charcoal (same family as `--ba-canvas`).
- Billing / plan marketing cards in light mode: do not render a random black slab; use `var(--ba-surface)` / `var(--ba-surface-elevated)` or intentional blue-dark token with readable text.
- Dark mode sidebar + bottom nav: same blue-dark family, never pure black.

Files: `personalPlan.css`, `index.css` CDLP tokens, `BillingPlanPanel.tsx`, `PlanMarketingPanel.tsx`.

### 3. Revenue — Z-Reading workspace button strip

**Problem:** Auto-generate / Manual / Upload / Import stacked as a thin left column with empty white space; feels unlinked from the workspace below.

**Fix:**

- Desktop/tablet: **2×2 grid** or full-width equal chips in one toolbar row (wrap, not a lonely vertical stack).
- Active mode visually connected to the panel below (shared border / `ba-subpanel` continuation).
- Touch targets ≥44px; no clipped labels.

File: `POSManager.tsx` (Z workspace mode switcher ~1938).

### 4. Invoices — duplicated / orphan top buttons

**Problem:** Top bar has New + Save Draft + Preview while Quick Actions repeats Preview + Save Draft (+ Download + Send). Looks unlinked.

**Fix (pick and apply consistently):**

- **Header:** `+ New invoice` only (primary create).
- **Quick Actions (right rail):** Preview, Save draft, Download PDF, Send — single source of truth for document actions.
- Phone: keep actions reachable (sticky rail or bottom sheet), no duplicate twin rows.

File: `InvoiceMakerPanel.tsx`.

### 5. Billing — plan card + team invite

**Problem:** Upgrade plan detail reads black; team invite shows “Request failed” with weak layout; Monthly/Annual + plan tabs spacing.

**Fix:**

- Plan preview uses blue-dark / surface tokens (see §2).
- Invite error: readable alert, fields aligned, Send invite contrast; don’t leave a broken strip mid-card.
- Phone: single-column plans already — verify no overflow.

File: `BillingPlanPanel.tsx` (+ invite API error surfacing if UI-only).

### 6. Verification Center / Document processor (Expenses upload)

**Problems seen:**

- Conjoined-invoice / Open sub-table / Open PDF row: uneven heights, mixed styles.
- Line-item **Type** cells: empty red chips.
- Category text truncated + overlapping check icon.
- AI interpretation log: light green on white (illegible in light mode).
- Live calc cards cramped; search vs + Add vertical misalignment.

**Fix:**

- One height system for action chips in the conjoined row; stack on phone.
- Type/category controls always show labels; fix overflow/`ba-field` padding.
- Trace/log text: `var(--ba-muted)` / high-contrast, never pale green on cream.
- Align Add with search; 44px controls.

Files: `DocumentProcessor.tsx` (+ related verify CSS in `businessApp.css`).

---

## P1 — Full-tab audit matrix (every surface)

For each row: **light + dark**, **390 / 768 / 1280**, note pass/fail + fix.

| Tab / area | Check |
|------------|--------|
| Dashboard | KPIs, IE rows, session banners, no clipped CTAs |
| Revenue | Hub chips, Z workspace (§3), tables→cards ≤1023 |
| Expenses | Upload, verification (§6), list actions |
| Invoices | Header/actions (§4), editor stack phone, line cards |
| Inventory | Keep “minimal” quality; regress nothing |
| Reports | Filters wrap; charts readable light/dark |
| Documents | Toolbar wrap; status pills; row actions ≥44px |
| Billing | Plans (§5), portal, team invite |
| Sidebar | Rail/collapsed; DEV ADMIN / Personal / Logout alignment; theme+lang |
| Floating chrome | Theme + language both findable; clear bottom nav |
| Personal Overview | Upload CTAs, KPIs, no duplicate Add vs FAB |
| Personal Budget/Bills/Goals | Forms never horizontally clip |
| Personal bottom nav | Blue-dark surface (§2), active state clear |
| Admin UK | Same as `/app` layout rules; GBP chrome only |

---

## Shared rules (enforce while fixing)

| Rule | Spec |
|------|------|
| One job per action cluster | No twin Save/Preview in two places |
| Toolbars | Wrap or grid — never orphan vertical stack with empty half-card |
| Contrast | WCAG-ish body text on cream/dark; no pale-on-pale logs |
| Dark surfaces | `#1a1d23` family only for chrome |
| Touch | ≥44×44px primary controls |
| Theme | Light + dark both first-class on business + personal |

---

## Implementation order

1. Theme toggle restore + blue-dark token align (personal nav + billing card).
2. Invoice action de-dupe; Z-reading mode grid.
3. Verification / DocumentProcessor contrast + type/category chips.
4. Pass matrix P1; fix leftovers.
5. Push **UI-only** commits (exclude unrelated HMRC / temp folders).

---

## Done when

- [ ] `/app` shows a working dark/light control without hunting Settings.
- [ ] Personal bottom nav and billing plan chrome match **blue-dark**, not black.
- [ ] Z-reading modes fill the workspace toolbar logically.
- [ ] Invoice actions have a single clear home (no twin Save/Preview).
- [ ] Verification type/category/log readable in light mode; no empty type chips.
- [ ] Inventory/Reports still look as clean as the user’s manual pass.
- [ ] Phone/tablet/desktop re-checked on the tabs that failed the human audit.

---

## Anti-patterns

- Declaring “audit done” from code grep alone.
- Hiding theme behind Settings only on business app.
- Fixing personal phone while leaving `/app` desktop button chaos.
- Pure black `#000` / `#120d0f` bars next to V3 blue-dark content.
