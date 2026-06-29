# Personal Plan — Google Stitch Super Prompt

Use this document to redesign the **Paystack.ch personal / household finance** experience in [Google Stitch](https://stitch.withgoogle.com). Target: the **Budget** tab (and related personal features) that will ship inside `/app` — currently prototyped at `/ali/budgeting`.

**Implemented (2026-06):** Stitch “Private Wealth” dark UI is wired in the Ali lab after `/ali-gate`:

| Route | Screen |
|-------|--------|
| `/ali/budgeting` | Personal budget (KPI strip, income/expense cards, zero-based donut) |
| `/ali/forecasting` | 90-day cash flow chart |
| `/ali/goals` | Goal tracking cards |
| `/ali/investments` | Portfolio + allocation treemap |
| `/ali/bill-reminders` | Bill timeline |

Code: `client/src/ali-lab/personal-plan/` (shell, theme) + redesigned panels in `client/src/ali-lab/features/`.

**Attach to Stitch:** upload the current `/ali/budgeting` screenshot as reference context, then paste the prompts below for further iterations.

---

## Product context (for the designer)

| Item | Value |
|------|--------|
| **Product** | Paystack.ch — Swiss personal & household finance (CHF, de-CH formatting) |
| **Audience** | Individuals and families in Switzerland (not restaurant payroll / VAT workflows) |
| **Competitors to beat on UX** | YNAB (zero-based), BudgetCH, BlueBudget |
| **Current prototype** | `/ali/budgeting` — functional but developer-centric (plain tables, no progress visuals) |
| **Promotion target** | New **Budget** tab in the personal dashboard at `/app` |
| **Languages** | EN, FR, DE, IT (labels must fit; avoid fixed-width English-only layouts) |
| **Out of scope** | Bank sync, CSV import, Open Banking — document upload + manual ledger only |

### Household categories (must appear in UI)

**Income expected:** Salary · Asset revenue · Contributions & gifts

**Expense budgets:** Bills · Rent · Groceries · Going out & activities · Shopping & other · Savings & invest

**Modes:** Traditional (flexible budgets) · Zero-based (every franc of income allocated)

**Live KPIs (top of screen):** Income · Expenses · Savings · Balance · Savings rate %

---

## What’s wrong today (design brief)

The current UI feels like an internal admin tool, not a consumer finance app:

- Dense uppercase labels, monospace-adjacent tables, no visual hierarchy
- Budget vs spent is numbers-only — no progress bars, rings, or “remaining to spend” cues
- Developer chrome mixed with user UI (promotion checklist, Firestore notes, `/app` links)
- Red accent reads as “system alert” rather than calm financial confidence
- Zero-based mode is a text line, not a guided allocation flow
- Mobile: wide tables will not work; needs card/stack layout
- Empty state (0 rows) feels broken, not inviting

**Goal:** Feel as trustworthy and calm as BudgetCH, as motivating as YNAB, as clear as BlueBudget — while staying unmistakably **Paystack / Geneva Jet d'Eau**.

---

## Brand design system (do not invent a new palette)

**Palette F — “Jet d'Eau”**

| Token | Hex | Usage |
|-------|-----|--------|
| Brand red / accent | `#E8423F` | Primary actions, active tab, key highlights |
| Charcoal | `#2B2B2B` | Headings, strong text |
| Cream | `#FCFAF4` / `#FFF5F4` | Light mode surfaces |
| Muted | `#6F6669` | Secondary text |
| Positive | emerald ~`#059669` | Under budget, savings up |
| Negative | red ~`#DC2626` | Over budget, deficit |

**Typography**

- Display / UI: **Sora** (geometric sans, confident but friendly)
- Body / long copy: **Source Serif 4** (optional for helper text)
- Numbers: tabular lining, **de-CH** locale (`1’234.50 CHF`)

**Dark mode:** background `#160F12`, card `#1F161A`, foreground `#F7F3F4` — same red accent.

**Tone:** Swiss precision + warmth. Not fintech neon. Not corporate ERP. Not playful crypto.

---

## Stitch workflow

1. **Upload** the current budgeting screenshot to Stitch canvas.
2. **Paste** the **Master prompt** below → generate **Desktop light** first.
3. **Variant prompts** → dark mode, mobile, zero-based mode.
4. **Atomic refinements** → one change per message (Stitch works best this way).
5. **Prototype** → stitch Budget + Goals + Bill reminders into one flow.
6. Export to Figma or front-end code → hand off to dev (`BudgetingPanel.tsx` + new `/app` tab).

---

## Master prompt (copy-paste into Stitch)

```
Design a high-fidelity desktop web app screen: "Paystack — Personal Budget" for Swiss household finance.

ANATOMY (structure):
- Top app bar: Paystack wordmark left; session selector ("All sessions" dropdown); month picker (June 2024); EN | FR | DE | IT language pills; user avatar right.
- Below: a horizontal KPI strip in a soft card — 5 metrics with large tabular numbers: Income, Expenses, Savings, Balance, Savings rate (%). Use green for positive, red for negative. Subtle caption: "Live from your ledger".
- Main content split:
  - Left (70%): two stacked sections — "Income expected" (3 rows) and "Household expenses" (6 rows). Each category is a ROW CARD, not a raw HTML table: category name + icon, editable budget field, spent/received amount, variance, horizontal progress bar (spent vs budget), and "remaining" pill. Total row pinned at bottom of each section.
  - Right (30%): "Budget mode" card with segmented control: Traditional | Zero-based. When Zero-based is selected, show a donut or stacked bar of "Income this month" vs "Allocated" vs "Unallocated CHF" with clear green/red state.
- Floating primary button bottom-right on mobile; on desktop use inline "Save" only if needed (auto-save implied).
- NO developer checklist, NO "promote to /app", NO Firestore debug text — this is production-ready consumer UI.

VIBE (aesthetic):
- Clean Swiss SaaS, calm and trustworthy, Jet d'Eau inspired.
- Light mode default: warm off-white background (#FCFAF4), white cards, subtle borders, generous whitespace.
- Accent color Geneva red (#E8423F) for primary actions and active states only — not everywhere.
- Soft shadows, 8px radius, bento-style cards. Progress bars use muted track + red when >100% spent, emerald when under budget.
- Typography: Sora for headings and UI; numbers large and tabular. Avoid all-caps wall of labels — use sentence case with small caps only for KPI labels.

CONTENT (real data):
- Currency: CHF always, Swiss formatting (apostrophe thousands separator).
- Income rows: Salary (expected 6’500, received 6’500), Asset revenue (800 / 750), Contributions (0 / 200).
- Expense rows with sample data:
  - Bills — budget 450, spent 380 (84%)
  - Rent — budget 1’800, spent 1’800 (100%)
  - Groceries — budget 600, spent 720 (120%, over budget — show red)
  - Going out — budget 250, spent 180
  - Shopping & other — budget 200, spent 95
  - Savings & invest — budget 500, spent 500
- Totals footer: expense budget 3’800, spent 3’675, remaining 125.
- Month: June 2024. Mode: Traditional.

INTERACTION hints (visual only):
- Inline editable budget amounts (subtle input styling).
- Hover on category row reveals "View transactions" link.
- Empty categories show dashed progress and helper text "Set a budget to track spending".

Deliver: one polished desktop screen, 1440px wide, production quality. Include component states for over-budget (Groceries) and zero-based mode preview in the side card.
```

---

## Variant prompts (run after master)

### Dark mode

```
Same Paystack Personal Budget screen as before, dark theme: background #160F12, cards #1F161A, text #F7F3F4, accent #E8423F. Keep identical layout and sample CHF data. Progress bars and KPI colors must stay accessible (WCAG AA contrast).
```

### Mobile (375px)

```
Mobile iPhone layout for Paystack Personal Budget. Stack KPI strip as 2×3 grid then horizontal scroll chips. Replace table rows with full-width category cards: icon, name, progress bar, spent/budget, remaining. Sticky top bar with month + mode. Bottom tab bar: Dashboard, Budget (active), Goals, Bills, More. Same Swiss sample data and red/emerald semantics.
```

### Zero-based mode (focused flow)

```
Paystack Personal Budget — Zero-based mode full screen. Hero at top: "Give every franc a job" with large unallocated amount (125 CHF in green or -200 in red). Income total 7’450 CHF at top. Category list shows allocation sliders or stepper inputs; running total "Allocated: 7’325 / 7’450". Prominent CTA when unallocated ≠ 0: "Assign remaining 125 CHF". Calm Swiss aesthetic, Sora typography, #E8423F accent.
```

### Empty state

```
Paystack Personal Budget empty state — new user, all zeros. Friendly illustration area (abstract Swiss mountains or coin stack, minimal line art). Headline: "Plan your month in CHF". Subcopy: "Set expected income and category budgets — we'll compare against your uploaded documents." Primary button "Set up June budget". Secondary "Upload a document". Light Jet d'Eau theme.
```

---

## Related screens (prototype flow in Stitch)

Use the master vibe for consistency across these additional frames:

| Screen | Purpose |
|--------|---------|
| **Goals** | Savings/debt goal cards with circular progress, deadline, "Add CHF" action |
| **Bill reminders** | Timeline list sorted by due date; overdue in red, due-soon amber badge |
| **Forecasting** | 90-day balance line chart + weekly table; starting balance from ledger |
| **Budget overview widget** | Compact dashboard card for `/app` home — top 3 categories near limit |

**Mini prompt for Goals:**

```
Paystack Goals screen, same design system as Personal Budget. Three goal cards: "Emergency fund" 3’200/10’000 CHF, "Vacation" 800/2’500, "Pay off credit card" 1’100/1’100 complete. Circular progress, deadline badges, + Add goal button. Desktop 1440px, light Jet d'Eau theme.
```

---

## Atomic refinement prompts (one at a time)

Use these after the base screen exists — **never combine more than one**:

- `Make category progress bars thicker (8px) and add percentage label inside the bar when >50%.`
- `Reduce red usage: only over-budget rows and primary CTA use #E8423F; KPI labels use charcoal.`
- `Add subtle category icons (Lucide-style outline): home for Rent, shopping cart for Groceries, receipt for Bills.`
- `Increase whitespace between income and expense sections; add section headers with monthly subtotals.`
- `Change budget inputs to right-aligned currency fields with "CHF" suffix inside the field.`
- `Add a compact "Savings rate 12%" sparkline next to the KPI strip.`
- `French UI variant: replace all labels with French (Revenus, Dépenses, Épargne, Factures, Loyer, etc.).`

---

## Anti-patterns (tell Stitch to avoid)

- No restaurant payroll, VAT net, or supplier categories in personal views
- No terminal/developer aesthetic (dense ALL CAPS, red headings everywhere)
- No bank connection CTAs or Plaid-style logos
- No purple gradient fintech clichés
- No pie charts as the primary budget view (progress bars / bars work better)
- Do not hide overspending — Groceries at 120% must be visually obvious
- Do not use `$` or `€` — **CHF only**

---

## Handoff to engineering

When a Stitch design is approved:

1. Implement in `client/src/ali-lab/features/BudgetingPanel.tsx` first (lab testing).
2. Match tokens in `client/src/index.css` (Palette F / cdlp-* / brand-red).
3. Reuse `personalCategories.ts` labels via i18n keys in `labStrings.ts` → later `LanguageContext.tsx`.
4. User approves in chat → promote to new tab in `RestaurantDashboard.tsx` (personal dashboard).
5. See `docs/ALI_LAB_SUPER_PROMPT.md` promotion checklist.

---

## Environment (for manual comparison while designing)

```bash
pnpm dev                 # http://localhost:3000/ali/budgeting
# Gate password: ALI_LAB_PASSWORD in .env (default ali123*)
```

Compare side-by-side with production ledger data at `/app` (same Firestore session).
