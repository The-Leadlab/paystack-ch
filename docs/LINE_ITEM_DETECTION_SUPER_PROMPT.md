# Super prompt: Detect every invoice line item

## Problem (repro)

Feldschlösschen / Swiss beverage **Bulletin de livraison** PDFs show dozens of article rows (Article, Désignation, Quantité, Prix, Valeur, TVA, Consigne) across multiple Commande blocks, but Verification Center shows:

- Correct document total (e.g. CHF 1'642.65)
- AI log mentioning “various beverages”
- **Document verification — per item**: “No line items detected”
- All Line Items: a single issuer/total row

Root causes:

1. Gemini collapses itemized invoices into one total `lineItem`.
2. Multiple Commande / Bulletin sections from the **same** supplier under one Montant final are often mis-split as `subDocuments`, wiping product lines from the per-item UI.
3. No second pass recovers product lines when the first pass only returns the invoice total.

## Goal

Extract **every** visible product/service/fee/deposit row into `lineItems` (and `subDocuments[i].lineItems` when truly multi-invoice) so per-item verification is populated.

## Rules

1. **PER-ITEM FIRST**: For Invoice / Ticket / delivery notes, never collapse an itemized table into a single lineItem equal to the invoice total.
2. **Swiss delivery tables**: Read Article / Désignation / Contenu / Quantité / Unité / Prix / Valeur / TVA / Consigne. One `lineItem` per article row: `description` = Désignation, `quantity` when clear, `unitPrice` = Prix, `amount` = Valeur.
3. **Consigne**: If Consigne > 0, add a separate EXPENSE line (`Consigne — {designation}`, amount = Consigne) or put consigne in `notes` — prefer separate lines when the column is filled.
4. **Same-supplier Commande blocks**: Multiple Commande / Bulletin de livraison sections under **one** Montant final / one invoice from the same issuer = **ONE** document; concatenate all article rows into top-level `lineItems`. Do not create one `subDocument` per Commande unless each block is a separately payable invoice with its own total.
5. **Footer fees**: Recycling tax, logistics, eco-tax, empty-crate returns → their own lineItems.
6. **Skip** header/subheader rows, sous-total / total / TVA-only summary rows (those go in vat/total fields).
7. **Second pass**: If after analysis product lines are missing (0 items, or only 1 item ≈ document total), run a dedicated line-item extraction pass and merge results.
8. **UI**: Per-item section must not hide products when multi-`subDocuments` lack nested items; filter synthetic invoice-rollup rows out of per-item tabs.

## Out of scope

- Changing ledger posting of invoice rollups for true multi-supplier binders.
- Manual OCR pipelines outside Gemini.

## Acceptance

- [ ] Feldschlösschen-style multi-page beverage delivery PDF yields many product `lineItems` (not one total row).
- [ ] Per-item verification lists each article with amount ≈ Valeur.
- [ ] Document total / Live Calculation still matches Montant final.
- [ ] True multi-invoice PDFs still get one `subDocument` per distinct invoice, with products nested when present.
