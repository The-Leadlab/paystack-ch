# Personal Finance Quest — Super Prompt

Related: `docs/PERSONAL_AI_DOCS_SAVINGS_SUPER_PROMPT.md` (auto AI fill + how much / how to save).
Related: `docs/PERSONAL_TABS_LEDGER_SUPER_PROMPT.md` (Budget/Reports/Goals/etc. must use the same personal ledger).

Use this document when implementing **personal** budgeting on `/app/personal` and `/ali` (overview + related panels). Reference product for **functionality** (not visual theme): **GoBudget — “Personal Finance Quest”** (credited to @mr.jodigo): Vite/React SPA, local persistence, CSV + PDF bank-statement parsing, category budgets.

Paystack branding, colors, and fonts stay as-is. Do **not** copy GoBudget’s theme.

---

## Hard isolation rule

Personal budget math must **not** follow restaurant Revenue / POS / Z-reading calculations from `/app` business tabs.

| Surface | Data source | Import path |
|---------|-------------|-------------|
| Business Revenue (`POSManager`) | Session income/expenses + Z-readings | Z CSV / Stripe CSV / photo AI |
| Personal overview | **Personal ledger** (IndexedDB) | Bank statement CSV / PDF only |

Never route personal statement rows through `revenueImport.ts`, `revenueAnalytics.ts`, or Z-reading save paths.

---

## In scope

1. **Upload bank statement** on personal **Overview** (CSV + PDF) — AI auto-analyzes, auto-fills, and auto-commits (see AI docs + savings super prompt).
2. Client-side **CSV parse** (column auto-map: date, description, amount / debit+credit).
3. **PDF parse** via existing Gemini `analyzeBankStatement` (same stack as document AI; personal destination only).
4. Preview is optional; default path writes into **personal IndexedDB ledger**.
5. Overview KPIs (income / expenses / savings / savings rate) computed **only** from that personal ledger for the selected month.
6. Manual “Add transaction” on personal surface writes to the **same personal ledger** (not restaurant Revenue).
7. Local import history (filename, counts, timestamps) in IndexedDB.
8. **AI savings coach** — how much to save + how to save.

## Out of scope

- Open Banking / live bank sync / feature id `bank-sync`.
- Wiring personal imports into Business Revenue or Documents tab.
- Changing Revenue industry modules or Z-reading workspace (except Connect-data bugfix below).

---

## Bug fix (Business Revenue)

**“Connecter données” / “Connect data”** must **not** navigate to Documents.

**Correct behavior:** stay on Revenue and scroll to (or focus) the Z-reading / CSV upload workspace (`uploadRef`). Documents remains a separate tab for invoice/receipt AI.

---

## Agent instructions (copy-paste)

```
Implement Personal Finance Quest functionality on Paystack personal surfaces.

Rules:
1. Write docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md if missing; follow it.
2. Personal overview KPIs = personal IndexedDB ledger only — never revenueAnalytics / POS Z totals.
3. Add Upload bank statement on PersonalDashboardPanel; CSV client-side; PDF via analyzeBankStatement.
4. Preview + confirm before committing rows; tag source as statement|manual.
5. Fix POSManager rhConnectData: scroll to uploadRef, do NOT onNavigateTab('documents').
6. Soften AGENTS.md / ALI lab docs: allow manual personal statement file import; still forbid Open Banking / bank-sync.
7. EN + FR strings in labStrings.ts (and dashboardTranslations only for Revenue connect if needed).
8. Match existing personal-plan GlassCard / CSS variables; do not restyle the app like GoBudget.
9. Do not push or commit unless the user asks.
```

---

## File map

| Path | Role |
|------|------|
| `client/src/ali-lab/lib/personalStatementImport.ts` | CSV parse + PDF→draft rows |
| `client/src/ali-lab/lib/personalBudgetStore.ts` | IndexedDB personal ledger + import history |
| `client/src/ali-lab/hooks/usePersonalBudgetLedger.ts` | Month totals + list for overview |
| `client/src/ali-lab/personal-plan/components/PersonalStatementUpload.tsx` | Upload UI + preview |
| `client/src/ali-lab/features/PersonalDashboardPanel.tsx` | Wire upload + personal KPIs |
| `client/src/cafe/components/POSManager.tsx` | Connect data → upload scroll |

---

## Acceptance checklist

- [ ] Personal overview shows Upload bank statement; CSV preview works without Firebase.
- [ ] Confirmed import updates personal KPIs for that month.
- [ ] Restaurant Revenue totals unchanged by personal import.
- [ ] Connect data on Revenue scrolls to upload area; does not open Documents.
- [ ] EN + FR labels present for upload / preview / confirm / empty state.
