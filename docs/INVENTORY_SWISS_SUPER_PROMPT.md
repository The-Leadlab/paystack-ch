# Inventory / Stock — Swiss restaurant super prompt (Phase 1)

Use this when working on the Stock tab (`/app?tab=inventory`) for Ali + Damien gated users. Do **not** promote to all `/app` users without explicit chat approval.

## Gate

Visible when any of: `ali@the-leadlab.com`, `damien@the-leadlab.com`, `VITE_INVENTORY_ENABLED`, `VITE_INVENTORY_EMAILS`, `users/{uid}.inventoryBeta`, admin app-access, or `/admin-uk`.

## Swiss advisor rules

1. **Konto 1200** (Scorte / Warenbestand) = balance-sheet **asset** from FIFO valuation. Not P&L. TVA paths unchanged.
2. **Purchases**: supplier Documents → Confirm stock-in at HT unit cost (CHF/GBP). Foreign VAT stays on expense/recon path.
3. **Sales**: Factures with linked inventory product → `stock_out` / `stock_restore` on cancel/delete.
4. **Waste / staff meals / count**: manual `stock_out` or signed `adjustment` (negative = shortfall).
5. Method = **FIFO** (Swiss CO method-neutral; FIFO fits perishables). No LIFO.
6. Dashboard / Reports show 1200 + low-stock + food-cost insight (FIFO outs vs period revenue).

## Phase 1 (shipped / in progress)

- Manager CRUD: add/edit/archive/delete products; stock in/out/adjust with toasts
- Restaurant seed presets (café/kitchen starters)
- Documents Apply-to-stock (remount-safe) + mark stock document
- Invoice stock sync awaited with errors; cancel restores stock
- Dashboard KPI 1200 click-through, low-stock strip, food-cost %
- Swiss workflow guide in UI (POS auto = Phase 2)

## Phase 2 (later)

- POS / Z-reading automatic `stock_out` (recipe → product qty)
- Barcode, multi-site warehouses

## Key files

- Gate: `shared/inventoryAccess.ts`, `client/src/cafe/hooks/useInventoryAllowed.ts`
- FIFO: `shared/inventoryFifo.ts`
- Stock docs: `shared/inventoryStock.ts`
- UI: `InventoryPanel`, `StockConfirmPanel`, `InvoiceMakerPanel`, `RestaurantDashboard`
- Context: `InventoryContext.tsx`
- Rules/indexes: `firestore.rules`, `firestore.indexes.json`
- Tests: `test/inventoryFifo.test.ts`, `test/inventoryAccess.test.ts`

## Agent checklist

1. Keep gate; do not expose Stock publicly.
2. Preserve VAT / FX behaviour.
3. On-hand qty = derived from movements (FIFO), never invent quantities on product docs alone.
4. After Phase 1 changes: run inventory vitests; commit stock files only; push `main`.
