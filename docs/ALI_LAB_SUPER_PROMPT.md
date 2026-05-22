# Ali Feature Lab — Super Prompt

Use this document when implementing competitor-gap features for Paystack.ch. All work happens on the password-gated sandbox **`/ali`** before promotion to production **`/app`**.

## Out of scope (do not implement)

**Bank connections** — no CSV import, no Open Banking, no bLink, no live bank sync. Paystack.ch stays on **document upload + AI extraction** (and manual ledger entry). IDs in `ALI_LAB_EXCLUDED_FEATURE_IDS` (`bank-sync`).

---

## Access

| Item | Value |
|------|--------|
| **Lab URL** | `https://<host>/ali` (local: `http://localhost:3000/ali`) |
| **Gate URL** | `/ali-gate` |
| **Password** | `ALI_LAB_PASSWORD` in server env (default in `.env.example`: `ali123*`) |
| **Dev fallback** | `VITE_ALI_LAB_PASSWORD` + `sessionStorage` after successful gate (Vite does not run Edge middleware) |
| **API** | `POST /api/ali/verify` `{ "password": "..." }` |
| **Registry** | `client/src/ali-lab/featureRegistry.ts` |
| **Panels** | `client/src/ali-lab/AliLabFeaturePanels.tsx` |

**Workflow:** scaffold in `/ali` → prototype → `ready` (user tests in lab) → **user approves in chat** → integrate into `RestaurantDashboard` / `/app` → set status `promoted`.

**Never auto-promote:** Cloud agents must not move UI into `/app` or mark `promoted` without explicit user approval in the conversation after lab testing.

---

## Agent instructions (copy-paste)

```
You are implementing Paystack.ch competitor features in the Ali Feature Lab.

Rules:
1. Work only under client/src/ali-lab/ and related shared types until the feature is "ready".
2. Do NOT wire features into /app unless the user explicitly asked to promote in chat after testing /ali.
3. Do NOT wire half-finished features into /app — use the promotion checklist only after user approval.
4. Match existing patterns: Firestore contexts, planCatalog entitlements, LanguageContext en|fr, CHF, Swiss VAT where relevant.
5. Update feature status in client/src/ali-lab/featureRegistry.ts as you progress.
6. Password gate: /ali-gate — do not remove or weaken ali lab auth.
7. NEVER implement bank-sync / bLink / CSV bank import — product excluded (see ALI_LAB_EXCLUDED_FEATURE_IDS).

For each feature:
- Read its section below
- Implement in AliLabFeaturePanels.tsx or new file client/src/ali-lab/features/<id>.tsx
- Add Firestore schema draft in comments before production migration
- Run pnpm build and manually test at /ali/<feature-id>

When promoting to /app:
- Move UI into client/src/cafe/components/RestaurantDashboard.tsx or new tab
- Add plan gating in shared/planCatalog.ts if needed
- Add i18n keys to LanguageContext.tsx
- Update firestore.rules for new collections
```

---

## Feature 1 — Budgeting (`/ali/budgeting`)

**Competitors:** YNAB (zero-based), BudgetCH, BlueBudget (auto from history).

**Goal:** Budget vs actual per category per month.

**Implementation plan:**

1. Firestore: `sessions/{sessionId}/budgets/{month}` → `{ categoryId, amountChf }`
2. UI: table category | budget | actual | variance % (actual from existing expenses)
3. Optional mode toggle: **traditional** vs **zero-based** (allocate all income to categories)
4. Lab prototype already in `BudgetingPanel` — replace mock with Firestore

**Promote to:** New **Budget** tab in `RestaurantDashboard.tsx`

---

## Feature 2 — Goal tracking (`/ali/goals`)

**Competitors:** YNAB, Buxfer, BlueBudget.

**Goal:** Savings / debt goals with progress bar.

**Implementation plan:**

1. Firestore: `users/{uid}/goals/{id}` → `{ name, targetChf, currentChf, deadline, type: savings|debt }`
2. Dashboard widget: top 3 active goals
3. Manual progress update + optional link to expense category

**Promote to:** Dashboard card + Firestore collection

---

## Feature 3 — Forecasting (`/ali/forecasting`)

**Competitors:** Buxfer (cash flow + retirement).

**Goal:** 90-day cash projection from historical data.

**Implementation plan:**

1. Compute trailing 3-month average income/expense by week
2. Chart: projected balance line (use existing `recharts` / `components/ui/chart.tsx`)
3. Optional: retirement stub (monthly contribution → target year) — low priority for restaurant SMB

**Promote to:** Reports tab extension

---

## Feature 4 — Bill reminders (`/ali/bill-reminders`)

**Competitors:** Buxfer, BlueBudget (Serafe, insurance).

**Goal:** Upcoming bills with due dates and amounts.

**Implementation plan:**

1. Firestore: `users/{uid}/bills/{id}` → `{ name, dueDate, amountChf, recurrence, remindDaysBefore }`
2. List sorted by due date; badge on dashboard when due &lt; 7 days
3. Future: email/push (not in v1)

**Promote to:** Notifications area + Firestore

---

## Feature 5 — Shared access (`/ali/shared-access`)

**Competitors:** BudgetCH family, YNAB Together, Buxfer access control, BlueBudget FairSplit.

**Goal:** Multi-user workspace with roles.

**Implementation plan:**

1. Firestore: `workspaces/{id}/members/{uid}` → `role: owner|editor|viewer|accountant`
2. Migrate data paths from `users/{uid}` to `workspaces/{wid}/sessions/...` (large migration — phase carefully)
3. Invites via email link token
4. **FairSplit:** shared expense pool + settlement IOU (optional module)

**Promote to:** Auth + `firestore.rules` overhaul — highest risk; do last among social features

---

## Feature 6 — Investments (`/ali/investments`)

**Competitors:** Buxfer portfolio.

**Goal:** Simple holdings tracker (symbol, qty, cost basis, last price).

**Implementation plan:**

1. Manual entry + optional CSV
2. Firestore: `holdings/{id}`
3. Reports: total portfolio CHF

**Promote to:** Optional Reports sub-section (Business+ plan)

---

## Feature 7 — German & Italian (`/ali/de-it-i18n`)

**Competitors:** BudgetCH (DE, FR, IT).

**Goal:** Full UI in DE and IT.

**Implementation plan:**

1. Extend `LanguageContext.tsx`: `type Language = 'en' | 'fr' | 'de' | 'it'`
2. Copy `translations.en` structure → `de`, `it` (start with lab samples in `DeItPanel`, then professional translation)
3. Locale formatting: `de-CH`, `it-CH` in `toLocaleString`

**Promote to:** Global language switcher on `/app`

---

## Feature 8 — Offline (`/ali/offline`)

**Competitors:** YNAB offline sync.

**Goal:** Queue document uploads when offline.

**Implementation plan:**

1. Service worker (Vite PWA plugin or manual `sw.ts`)
2. IndexedDB queue: `{ file, sessionId, queuedAt }`
3. On `online` event: flush queue through existing `DocumentProcessor` pipeline

**Promote to:** `client/public/sw.js` + register in `main.tsx`

---

## Feature 9 — Automation rules (`/ali/automation-rules`)

**Competitors:** Buxfer rules.

**Goal:** User-defined if/then categorization.

**Implementation plan:**

1. Firestore: `users/{uid}/rules/{id}` → `{ match: string|regex, field: description|issuer, category, type: income|expense }`
2. Apply on: bank import + Gemini result post-processing
3. UI: ordered rule list, test against sample string

**Promote to:** Settings panel in dashboard

---

## Promotion checklist (required before `/app`)

- [ ] Works with signed-in Firebase user and real session
- [ ] `firestore.rules` updated and tested
- [ ] Plan entitlement in `shared/planCatalog.ts` (if paid feature)
- [ ] EN + FR strings (DE/IT if user-facing and promoted with i18n feature)
- [ ] No secrets in `VITE_*` client env
- [ ] `pnpm build` passes
- [ ] Status → `promoted` in `featureRegistry.ts`

---

## Lab implementation status (2026-05)

| Feature | Status in `/ali` | Notes |
|---------|------------------|--------|
| budgeting | **ready** | Real spent from FinanceContext; budgets in `ali_lab_budgets` |
| bill-reminders | **ready** | CRUD + overdue/due-soon styling |
| goals | **ready** | Savings/debt progress |
| bank-sync | **excluded** | Do not build — document/AI flow only |
| de-it-i18n | **ready** | `labStrings.ts` + coverage table (lab only) |
| forecasting | **ready** | 90-day chart, starting balance, weekly table |
| automation-rules | **ready** | Rules CRUD, enable/disable, `detectCategory` test |
| shared-access | **prototype** | Mock invites + FairSplit note |
| offline | **prototype** | Queue simulation |
| investments | **prototype** | Holdings portfolio |

Code lives under `client/src/ali-lab/` — **not** wired into `/app`.

## Priority order (recommended)

1. ~~`budgeting` + `bill-reminders` + `goals`~~ (done in lab)
2. Harden `de-it-i18n`, `forecasting`, `automation-rules` → `ready` in lab (user tests)
3. `shared-access` + `offline` + `investments` prototypes → ready when solid
4. **Only after user says promote in chat:** move ready features to `/app` + `promoted` status

---

## Environment variables

```bash
# Server (Vercel + stripe dev server)
ALI_LAB_PASSWORD=ali123*

# Client dev fallback when /api/ali not running
VITE_ALI_LAB_PASSWORD=ali123*
```

Run for local API gate:

```bash
pnpm dev:stripe-server   # port 8787 — serves POST /api/ali/verify
pnpm dev                 # proxies /api/ali → 8787
```

---

## Related docs

- `docs/I18N_SUPER_PROMPT.md` — full-site translation fixes (landing, `/app`, `/ali`)
