# Personal Real-Life UX — Super Prompt

Use this when hardening **`/app/personal`** so a real household can run bills, goals, receipts, and planning without restaurant/business leakage — with AI that uses a **Swiss personal tax / household** knowledge base (not the business Revenue brain).

Related: `docs/PERSONAL_AI_DOCS_SAVINGS_SUPER_PROMPT.md`, `docs/PERSONAL_TABS_LEDGER_SUPER_PROMPT.md`, `docs/PERSONAL_FINANCE_STATEMENT_SUPER_PROMPT.md`.

---

## Problems (client QA)

1. **Photos** — Users must upload bill/receipt **photos** (JPG/PNG/HEIC where possible), not only CSV/PDF statements.
2. **Bill reminders** — Hardcoded Swiss seed bills (Serafe / RC) and “dashboard-ish” preset copy feel fake; start empty; only the user’s bills.
3. **Financial goals** — “New goal” appears to do nothing; create/contribute must be obvious and reliable.
4. **Confidence bar** — Product must feel fully equipped for family budget + planning + investments tracking, with AI as capable as business docs but **personal-tax aware**.

---

## Product rules

### A. Isolation

- Personal ledger stays in personal IndexedDB / personal APIs — never Revenue / restaurant finance.
- No restaurant Z-reading, COGS, or business VAT recipes in personal AI prompts.

### B. Bills

- Default seed list = **[]** (no hardcoded Serafe/RC).
- Add bill: name, due, amount, frequency + optional **photo/receipt**.
- Optional **AI fill from photo** (issuer, amount, date) using Swiss household receipt knowledge.
- “Log payment” still opens personal transaction modal / personal ledger only.
- Remove or rewrite “Swiss presets until sign-in” copy.

### C. Goals

- “New goal” focuses/opens the create form (highlight + focus name); show validation if empty.
- Creating a goal visibly adds a card; contribute custom CHF (not only +500).
- Target amount uses string-safe inputs (no silent NaN).

### D. Upload / AI

- Statement upload accepts **images** as well as CSV/PDF.
- Shared Swiss personal finance AI context: CHF household, AHV/AVS, BVG, pillar 3a, Krankenversicherung, Quellensteuer, cantonal awareness — never restaurant POS.

### E. Do not

- Open Banking / bank-sync.
- Wire personal into `/app` business Revenue.
- Push unless asked.

---

## Agent instructions

```
Apply docs/PERSONAL_REAL_LIFE_UX_SUPER_PROMPT.md.

1. Empty bill seeds; photo/receipt on bills + AI fill from image.
2. Goals: New goal focuses form + validation; custom contribute; reliable add.
3. Statement upload: accept images; parse via personal AI path.
4. Central Swiss personal-tax AI context used by classify / savings / receipt fill.
5. EN/FR (and existing lab locales) strings; no business dashboard hardcodes.
```

---

## File map

| Path | Role |
|------|------|
| `docs/PERSONAL_REAL_LIFE_UX_SUPER_PROMPT.md` | This prompt |
| `client/src/ali-lab/lib/personalSwissTaxAi.ts` | Shared AI knowledge preamble |
| `client/src/ali-lab/lib/personalAiAssist.ts` | Use preamble |
| `client/src/ali-lab/lib/personalStatementImport.ts` | Image statements |
| `client/src/ali-lab/features/BillRemindersPanel.tsx` | Empty + photos |
| `client/src/ali-lab/features/GoalsPanel.tsx` | Working New goal |
| `client/src/ali-lab/types.ts` | Bill receipt fields |
| `client/src/ali-lab/i18n/labStrings.ts` | Copy |

---

## Acceptance

- [x] Bills start empty; user can add bill + photo; AI can suggest fields from photo.
- [x] New goal creates a goal; contribute works; no silent no-ops.
- [x] Overview upload accepts photo receipts/statements.
- [x] Personal AI prompts reference Swiss personal tax/household context, not restaurant.
- [x] No Serafe/RC seed bills hardcoded into new installs.
