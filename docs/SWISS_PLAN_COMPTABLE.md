# Swiss chart of accounts (Plan comptable CH — PME)

Reference: **Plan comptable suisse PME** (Swiss SME chart of accounts), aligned with the PDF `Plan comptable CH.pdf`.

## In `/app`

Each **income** and **expense** row can carry an optional **`account_code`** (konto), e.g.:

| Type | Example konto | Label (FR) |
|------|---------------|------------|
| Cash | `1020` | Compte courant bancaire |
| Inventory | `1200` | Stocks |
| Machinery (asset) | `1500` | Machines et appareils |
| IT (asset) | `1521` | Informatique |
| Vehicles (asset) | `1530` | Véhicules |
| Buildings (asset) | `1600` | Immeubles d'exploitation |
| Goods purchase | `4200` | Achats de marchandises |
| Sales revenue | `3200` | Ventes de marchandises |
| Services revenue | `3400` | Ventes de prestations |
| Salaries | `5200` | Salaires (commerce) |

### UI

- **Dashboard → Income / Expenses**: gold **konto badge** on each row; edit to search the full chart.
- **Auto-suggest**: category + description → default konto (`shared/suggestSwissAccountCode.ts`).
- **Reports CSV/PDF**: includes `account_code` column when present.

### Data

- Full list: `shared/data/swissChartOfAccounts.json` (**974 accounts**)
- Lookup API: `shared/swissChartOfAccounts.ts`
- Rebuild from PDF text: `node scripts/build-swiss-coa.mjs shared/data/plan-comptable-ch.txt`

### Firestore

- Field: `accountCode` on `income` and `expenses` documents (camelCase in Firestore, `account_code` in app types).

## Asset accounts (ACTIFS 1000–1799)

Fixed assets, inventory, cash, receivables, and financial investments are in section **ACTIFS**. When posting capital purchases (equipment, vehicles, software), prefer kontos **1500–1799** rather than expense classes **4xxx–6xxx**.

## Agentic AI classification (document upload)

After Gemini OCR (`analyzeFinancialDocument`), the pipeline runs automatically:

1. **RAG** — `shared/swissAccountRag.ts` retrieves top **15** candidates from `shared/data/swiss_chart_of_accounts_taxonomy.json` (942 accounts + classification rules).
2. **Agentic reasoning** — `swissAccountClassifierService.ts` asks Gemini to pick one konto from candidates only (not the full chart).
3. **Confidence** — `≥ 0.85` → auto-assign on ledger row; `< 0.85` → amber **needs review** in document UI.
4. **Splits** — mixed receipts can return multiple kontos (office + meals).

Taxonomy source: `Implementing AI for Swiss Tax Asset Code Classification/swiss_chart_of_accounts_taxonomy.json`.

Env: optional `VITE_GEMINI_CLASSIFIER_MODEL` (defaults to `VITE_GEMINI_MODEL` / `gemini-2.5-flash`).

## Agent rules

1. Do not invent kontos — use `searchSwissAccounts()` or the JSON file.
2. Asset purchases → 1xxx (balance sheet); operating expenses → 4xxx–6xxx (P&L).
3. Keep EN + FR labels from the official chart; UI language picks `labelEn` or `labelFr`.
4. Bank statement lines use RAG-only (no extra Gemini per line) via `classifyLineItemAccountCode`.
