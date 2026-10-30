# Paystack Mobile App UX — Super Prompt

Act as a **senior mobile product designer + front-end implementer**. Turn Paystack.ch (`/app` business + `/app/personal`) into a **phone-first product** that feels like a native finance app — not a shrunk desktop dashboard.

**Primary delivery:** responsive SPA + installable PWA (phone-feel shell).  
**Secondary (later, only if asked):** Capacitor wrap of the same UI — do not start a React Native rewrite.

Related: `docs/BUSINESS_APP_V3_DESIGN_SUPER_PROMPT.md`, `docs/DASHBOARD_V3_SUPER_PROMPT.md`, `docs/PERSONAL_BUSINESS_VISUAL_PARITY_SUPER_PROMPT.md`, `docs/COLLAPSIBLE_SIDEBAR_SUPER_PROMPT.md`.

---

## Role & mindset

You are designing for a Swiss café / restaurant owner on an iPhone or Android in the kitchen, between services:

- One thumb, one job, under 5 seconds to capture a ticket.
- Numbers must be readable at arm’s length; CTAs must be fat and unmistakable.
- Desktop layout stays excellent — mobile is a first-class shell, not an afterthought.

Do **not** invent purple-glow fintech clichés. Stay inside Paystack V3 tokens (charcoal / cream, accent blue APPROVE, red/green for money, Inter).

---

## Open-source design references (study, don’t clone)

Use these as **interaction / IA references**. Re-express in Paystack V3 tokens. Never paste their brand assets or copy layouts 1:1.

| Reference | Why it matters for Paystack |
|-----------|-----------------------------|
| [Ionic Framework](https://ionicframework.com/docs/components) — Tabs, Sheet, Action Sheet, FAB, Refresher | Native-feeling tabs, pull-to-refresh, bottom sheets for verify/approve |
| [Capacitor](https://capacitorjs.com/docs) | Phase-2 packaging only (camera, status bar, safe area) |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + existing `client/public/manifest.webmanifest` | Installable home-screen app, offline shell later |
| [Vaul](https://vaul.emilkowal.ski/) (Drawer) / shadcn Sheet pattern | Bottom sheets for Verification Center & filters on phone |
| [Actual Budget](https://github.com/actualbudget/actual) (open-source finance) | Dense money UI that still works on narrow screens; ledger lists |
| [Firefly III](https://github.com/firefly-iii/firefly-iii) mobile patterns (community) | Transaction rows, category chips, quick-add |
| Material Design 3 — Navigation bar (≤5 destinations) | Cap primary tabs; overflow the rest |
| Apple HIG — Tab bars, sheets, large titles (principles only) | Thumb reach, 44pt+ targets, clear hierarchy |

**Anti-references:** overcrowded 8–9 icon tab bars; desktop tables with 8 columns on 390px; tiny `9px` labels as the only way to fit more tabs.

---

## Current state (baseline)

Already present — improve, don’t delete blindly:

- Fixed mobile bottom nav in `RestaurantDashboard.tsx` (`md:hidden`, safe-area insets).
- Hamburger → slide-over sidebar (sessions, reset, language, personal link).
- Personal plan shell: `.pp-mobile-nav` in `personalPlan.css`.
- PWA icons + `client/public/manifest.webmanifest`.
- V3 tokens under `.ba-v3` / `.cafe-shell` (light + dark).

**Main UX debt:** bottom bar currently packs too many destinations (Dashboard, Revenue, Expenses, Invoices, Inventory, Reports, Documents, Billing). Labels shrink to ~9px. That reads as “website squeezed into a phone,” not an app.

---

## Product rules

1. **Phone shell first** — at `< md` (768px), the product is an app: top bar + scroll body + ≤5 bottom tabs (+ “More” sheet).
2. **Desktop unchanged in spirit** — sidebar nav stays; bottom bar remains `md:hidden`.
3. **Preserve data** — no Firestore schema, Gemini, Stripe, or session logic changes unless required for UI (e.g. tab id rename mapped to same `activeTab`).
4. **Business ≠ Personal** — personal ledger stays personal; no Revenue / restaurant VAT in personal AI.
5. **Do not promote `/ali` lab features** into `/app` unless the user explicitly approves after testing.
6. **EN + FR** (and existing locales) for every new string.
7. **Theme-aware** — use `--ba-*` / `--pp-*` tokens; no hardcoded white text on light surfaces.

---

## Information architecture (phone)

### Business `/app` — primary tabs (max 5)

| Tab | Role | Maps to existing |
|-----|------|------------------|
| **Home** | KPIs + upload CTA + recent docs | `dashboard` |
| **Money** | Revenue + Expenses (segmented control inside) | `revenue` / `expenses` |
| **Capture** | Center FAB / prominent tab → camera or file upload | opens upload / processor |
| **Docs** | Document list + verification entry | `documents` (+ invoices entry point) |
| **More** | Sheet: Reports, Inventory, Billing, Sessions, Personal, Settings | overflow |

Optional: keep Invoice Maker under Docs as a secondary chip, not a 6th tab.

### Personal `/app/personal` — primary tabs (max 5)

Align with existing personal plan destinations (Overview / Plan / Bills / Goals / More). Prefer one shared mobile shell pattern with business (same tab height, FAB rules, sheet grammar).

### Capture (hero mobile job)

On phone, **photograph / upload a ticket** is the #1 action:

- Center **Capture** control (raised pill or FAB, not a skinny 9th tab).
- Prefer `capture="environment"` / file input with images + PDF.
- After AI: deep-link into Verification as a **full-screen sheet** (preview top or swipeable; form below; sticky **APPROVE**).

---

## Visual & interaction system (mobile)

### Shell

| Layer | Spec |
|-------|------|
| Viewport | `100dvh`; `env(safe-area-inset-*)` on top bar + bottom nav |
| Top bar | Logo mark + page title + hamburger (sessions/tools) OR large title + trailing actions |
| Bottom nav | 56–64px content height + safe-area; icon 22–24px; label ≥10–11px, max 5 items |
| Active tab | Accent fill chip (existing gold/primary), not color-only |
| Touch targets | ≥44×44px; list rows ≥52px |
| Motion | 200–280ms sheet/tab transitions; respect `prefers-reduced-motion` |

### Content density

- KPI row: horizontal snap-scroll cards (2–2.5 cards visible), not 4 cramped columns.
- Document “table” on phone → **card list** (issuer, amount, status pill, chevron). Desktop keeps table.
- Filters → horizontal chip row or bottom sheet, not a wide toolbar.
- Verification → Vaul-style bottom sheet / full-height drawer; sticky APPROVE above home indicator.

### Typography

Keep Inter. On phone:

- Page title ~20–22px semibold (not all-caps screaming full bleed unless it already is brand).
- Meta / tab labels ≥10px; avoid 7–9px except badges.
- Amounts: tabular figures where possible; CHF with existing `de-CH` / `useChfLocale`.

### Do / don’t

- **Do** one primary CTA per screen (Capture, APPROVE, Add bill).
- **Do** pull-to-refresh on Home / Docs if data reload is cheap and safe.
- **Don’t** add a second floating FAB that fights Capture.
- **Don’t** force desktop sidebar width on phone.
- **Don’t** change marketing `/` in this pass unless asked.

---

## Architecture / file map

| Area | Likely files |
|------|----------------|
| Business shell + tabs | `client/src/cafe/components/RestaurantDashboard.tsx` |
| V3 CSS | `client/src/cafe/businessApp.css` |
| Sidebar | `client/src/cafe/components/BusinessSidebarNav.tsx` |
| Upload / verify | `client/src/cafe/components/DocumentProcessor.tsx` |
| Personal mobile nav | `client/src/ali-lab/personal-plan/components/PersonalPlanShell.tsx`, `personalPlan.css` |
| PWA | `client/public/manifest.webmanifest`, Vite PWA plugin if adding SW |
| i18n | `client/src/cafe/i18n/dashboardTranslations.ts`, personal `labStrings` / plan i18n |

Prefer extracting:

- `MobileTabBar.tsx` — shared business tab strip (≤5 + More).
- `MobileMoreSheet.tsx` — Reports / Billing / Inventory / Sessions shortcuts.
- `MobileDocCardList.tsx` — phone list adapter over document rows (optional if JSX stays in DocumentProcessor).

Scope CSS under `.ba-v3` + a clear mobile block, e.g. `@media (max-width: 767px) { .ba-v3 … }` or `.ba-mobile-shell`.

---

## Phase plan

### Phase 1 — Phone shell (this prompt’s default)

1. Collapse business bottom nav to ≤5 destinations + More sheet.
2. Raise Capture as the central action.
3. Home: snap KPI carousel + compact upload.
4. Docs: card list on `<md`; keep desktop table.
5. Verification: full-height sheet with sticky APPROVE.
6. Align personal bottom nav height / safe-area / label size with business.
7. Audit `manifest.webmanifest` name, short_name, theme_color, display `standalone`.
8. EN/FR strings for More sheet + Capture.

### Phase 2 — PWA hardening (only if asked)

- `vite-plugin-pwa` / service worker; offline shell; queue uploads (see Ali lab Offline notes).
- Install prompt UX (non-spammy).

### Phase 3 — Capacitor (only if asked)

- Wrap existing build; status bar + splash + camera plugin.
- No separate RN codebase.

---

## Agent instructions (paste into chat)

```
Apply docs/MOBILE_APP_UX_SUPER_PROMPT.md as a senior mobile UI/UX designer.

Goal: make /app (and personal) feel like a phone finance app — PWA/responsive shell first.
Do NOT start Capacitor or React Native unless I explicitly ask.

1. Collapse business mobile bottom nav to ≤5 tabs + More sheet (Home, Money, Capture, Docs, More).
2. Capture is the hero mobile action (upload/camera).
3. Phone: KPI snap-scroll; documents as cards; verification as bottom/full sheet with sticky APPROVE.
4. Keep desktop sidebar + table behavior; preserve Firestore/Gemini/Stripe/session logic.
5. Match personal mobile nav rhythm to business; keep personal data isolated.
6. Stay on V3 tokens (light+dark); EN/FR strings; safe-area insets; ≥44px targets.
7. Study Ionic tabs/sheets, Vaul drawers, Actual Budget density — re-express, don’t clone.
8. Verify on ~390×844 viewport + desktop; pnpm build succeeds.

Out of scope: marketing landing redesign, /ali promotion, Open Banking, native rewrite.
```

---

## Acceptance checklist

- [ ] On a 390px-wide viewport, bottom nav has ≤5 primary items; labels readable (≥10px).
- [ ] Capture is obvious within one second of opening `/app` on phone.
- [ ] Upload → process → open verification → APPROVE still works end-to-end.
- [ ] Revenue / Expenses reachable via Money (or equivalent) without losing features.
- [ ] Reports, Inventory, Billing reachable from More (or sidebar) on phone.
- [ ] Document list usable as cards on phone; table intact on desktop.
- [ ] Safe-area: content not under notch or home indicator; bottom nav clears scroll content.
- [ ] Light + dark themes still correct (no white-on-cream bugs).
- [ ] Personal shell still isolated; no restaurant Revenue leakage.
- [ ] `pnpm build` succeeds; EN/FR for new chrome strings.
- [ ] Adding to Home Screen (existing manifest) shows Paystack name/icon sensibly.

---

## Out of scope

- React Native / Flutter rewrite
- Open Banking / live bank sync
- Promoting Ali lab features into `/app` without explicit chat approval
- Changing Stripe prices, Gemini prompts, or Firestore schema for “design” reasons
- Full marketing site redesign

---

## Design north star (one sentence)

**Paystack on a phone should feel like a Swiss operator’s capture tool with a calm money home — five thumbs, one Capture, zero desktop leftovers.**
