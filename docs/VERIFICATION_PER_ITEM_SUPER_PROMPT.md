# Document verification — per item — Super Prompt

Use this when adding **Document verification — per item** next to the existing **Document verification — per invoice** in the Verification Center.

Related: `docs/DRESS_REHEARSAL_SUPER_PROMPT.md` (items ≠ invoices), `docs/BUSINESS_APP_V3_DESIGN_SUPER_PROMPT.md`.

---

## Goal

In Verification Center (`DocumentProcessor` → `VerificationHub`), keep per-invoice tabs, and add a parallel **per item** section that lists/edits each product/service line detected on the invoice (description, qty, unit price, amount, category, verify).

**Ship locally first** — do not push to remote until the user confirms after testing.

---

## Rules

1. Items stay in `lineItems` (or `subDocuments[i].lineItems` for multi-invoice). Never promote items into `subDocuments`.
2. Per-invoice UX stays unchanged (tabs + issuer/net/VAT/gross).
3. Per-item UX mirrors per-invoice: gold title, hint, horizontal tabs, detail form for the active item.
4. Single invoice: product lines in top-level `lineItems`.
5. Multi-invoice: product lines nested on each `subDocuments[i].lineItems`; top-level `lineItems` remain one-row-per-invoice rollups for ledger.
6. Editing product items must not break multi-invoice header totals (sum of invoice tabs).
7. EN + FR i18n keys beside `dpPerInvoice*`.

---

## Agent instructions

```
Apply docs/VERIFICATION_PER_ITEM_SUPER_PROMPT.md.

1. Add VerificationHub section "Document verification — per item" (tabs + detail form).
2. Gemini: extract every product line (qty/unitPrice); nest on subDocuments for multi-invoice; preserve nested items in normalizeMultiInvoiceData.
3. i18n EN/FR: dpPerItemTitle, dpPerItemHint, dpItemNofM, etc.
4. Do NOT push remote — local test only until user asks.
```

---

## Acceptance

- [x] Verification Center shows per-invoice AND per-item when product lines exist.
- [x] User can switch item tabs and edit/verify each line.
- [x] Single-invoice PDFs extract multiple product `lineItems`.
- [x] Multi-invoice: items scoped to active invoice via nested `lineItems`; header totals still = sum of invoices.
- [x] No remote push until user confirms.
