# Budget Persist + Cent Precision — Super Prompt

Client QA (2026-07-30): Expected budget amounts vanish on refresh; payslip/document amounts round to whole francs (1499,5 → 1500).

Related: `docs/DASHBOARD_QA_FIXES_SUPER_PROMPT.md`, `docs/PERSONAL_CLIENT_QA_SUPER_PROMPT.md`.

---

## Problems

1. **Expected budgets don’t stick** — Salary Expected input shows typed value, but Total stays `CHF 0 / 0` and refresh clears it. Income rows only commit on blur (no Enter / debounce); Firestore write failures drop local state; totals read saved `budgetChf` not drafts.
2. **Rounding to francs** — `formatChfDisplay` defaults to 0 decimals (`Math` locale round → 1499.5 → 1500). Document/manual amounts must keep centimes.

---

## Product rules

### A. Budget Expected
- Persist Expected on blur, Enter, **and** debounced change (~400ms).
- Optimistic localStorage write even if Firestore fails; surface a toast/inline error if cloud sync fails.
- Totals while editing use draft parsed amounts (not only saved rows).
- Show Expected prominently (not only “received” as the big number).

### B. Cent precision
- Default money display: **2 decimal places** (centimes). Optional whole-franc display only when explicitly requested.
- AI extract prompt: copy amounts exactly; never round to whole CHF.
- Keep `round2` (×100) for float hygiene — never round to integers.

---

## Agent instructions

```
Apply docs/BUDGET_PERSIST_CENTS_SUPER_PROMPT.md.

1. Harden useAliLabPersist add/update (local-first, Firestore try/catch).
2. BudgetingPanel: debounce+Enter commit for income Expected; draft-aware totals; clearer Expected UI.
3. formatChfDisplay default decimals=true.
4. Gemini prompt: preserve centimes exactly.
5. Tests for parse/persist display. Do not push unless asked.
```

---

## Acceptance

- [x] Type Expected Salary `1000`, leave field / wait debounce → Total shows expected; refresh still shows 1000.
- [x] Payslip / expense amounts show `1'499.50` not `1'500`.
- [x] Manual personal/business amounts keep cents.
