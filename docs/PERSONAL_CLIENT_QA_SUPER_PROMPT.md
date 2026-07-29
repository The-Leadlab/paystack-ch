# Personal + Revenue Client QA — Super Prompt

Use this when applying the **2026-07-28 WhatsApp video / Gemini resume** feedback for personal finance + Revenue hub.

Source: client walkthrough video + verbatim transcript (Upload → Budget → Bills → Reports → Savings → Investments → Business Revenue sectors).

Related: `docs/PERSONAL_REAL_LIFE_UX_SUPER_PROMPT.md`, Revenue hub prompts.

---

## Problems (exact client asks)

1. **Multi-file upload** — “I gotta do one at a time? That’s a joke.” Enable multi-select batch upload for personal statements/receipts and bill photos (and any similar single-file personal inputs).
2. **Budget mode copy** — Switching Traditional ↔ Zero-based must change the explanation text (not “Every CHF has a job” for both). Explain what Spent means (from uploaded documents / ledger).
3. **Fixed vs variable household expenses** — Group categories into Fixed/Necessities (rent, bills/insurance/Serafe) vs Variable (groceries, going out, shopping). Bills category should be clickable → Bills tab.
4. **Reports look dreadful** — Redesign 90-day projection chart (readable on light/dark, real scale, labels, no hard-coded dark grid).
5. **Add goal does nothing** — Savings form must persist goals reliably (no silent Firestore/undefined failures).
6. **Add holding does nothing** — Investments form must validate, persist, and show errors.
7. **Bill reminders broken** — Frequency select text illegible; bill must stay on the list after add; multi photo attach.
8. **Revenue sectors** — Load/refresh demo must **not** force all sectors on; keep the user’s sector filter.
9. **POS / Manus sandbox** — Out of scope for this code pass (ops/deploy). Document only: need a separate Manus-connected copy for Z-reading auto-gen testing (e.g. Café de la Place).

---

## Agent instructions

```
Apply docs/PERSONAL_CLIENT_QA_SUPER_PROMPT.md.

1. Multi-file: PersonalStatementUpload + BillRemindersPanel photos (batch).
2. Budget: dynamic mode descriptions; Fixed / Variable expense groups; Bills → /bills link.
3. ForecastingPanel: readable 90-day chart (theme CSS vars, axes, zero line).
4. Strip undefined in addLabDoc/updateLabDoc; await add with errors on Goals + Holdings + Bills.
5. Bill select option CSS; reliable save (omit huge receipt from Firestore if needed, keep local).
6. seedDemoData: do NOT overwrite activeSectors / saveStoredSectors(all).
7. EN/FR strings for new copy. Do not push unless asked.
8. Do not implement Manus POS deploy here — note under Out of scope.
```

---

## Acceptance

- [x] Can select multiple statement/receipt files and import them in one go.
- [x] Budget mode subtext changes for Traditional vs Zero-based; spent explained.
- [x] Household expenses show Fixed / Variable groups; Bills navigates to bill reminders.
- [x] Reports chart readable with axis/labels on light theme.
- [x] Add goal and Add holding create visible rows (signed-in Firestore included).
- [x] Add bill keeps the bill visible; frequency select readable; multi photos.
- [x] Demo load/refresh preserves current sector filter.
- [x] Manus POS sandbox listed as ops follow-up, not coded here.
