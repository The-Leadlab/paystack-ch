# Inventory / stock plan

Tab visible to all with Coming Soon; full unlock for Ali, Damien, Louise, and everyone on `/admin-uk` (GBP).

**Living super prompt:** [INVENTORY_SWISS_SUPER_PROMPT.md](./INVENTORY_SWISS_SUPER_PROMPT.md) — Phase 1 Swiss sync + manager controls; Phase 2 POS ticket/Z2 stock-out + recipes (shipped).

## What this is

A first slice of inventory for Swiss restaurant books (and the same flag on UK UAT for Louise). Products, quantities in/out/on hand, FIFO cost, sales-invoice stock-out, supplier-invoice stock-in with a manual confirm step, and a balance-sheet stock asset on konto **1200**. VAT flows are unchanged.

POS stock-out from itemized Ticket/Receipt / Z2 sheets + POS recipes is live (confirm panel). Aggregate Z-reading totals without articles still cannot auto-decrement. Barcode scanning and multi-site warehouses remain later.

## Who can use it

- **Nav tab:** visible to all `/app` users (Coming Soon / blurred teaser if locked).
- **Full unlock (interactive stock):**
  - Built-in emails: `ali@the-leadlab.com`, `damien@the-leadlab.com`, `louise@the-leadlab.com` (CHF `/app` + UK)
  - Anyone on UK UAT (`/admin-uk`) — GBP / UK VAT / `admin-uk-uat` Firestore
  - Optional: `VITE_INVENTORY_ENABLED=true`, `VITE_INVENTORY_EMAILS`, `inventoryBeta`, admin app-access

## Data model (Firestore)

Collections live next to expenses, scoped by `restaurantId` (workspace owner uid) **and `sessionId`** (current session). Each session has its own catalog, movements, and POS recipes — New Session starts empty. Legacy rows without `sessionId` are hidden. Master Reset and session delete wipe inventory collections. UK UAT uses the isolated `admin-uk-uat` database.

### `inventory_products/{id}`

| Field | Meaning |
| --- | --- |
| restaurantId | Workspace owner |
| sessionId | Session this product belongs to (required on new writes) |
| name, sku, unit | Catalog |
| category, subcategory | Optional; presets by business type (restaurant, garage, retail, general) |
| minStockLevel | Optional low-stock alert |
| archived | Soft hide |

On-hand qty and valuation are **derived from movements** (FIFO), not trusted as source of truth on the product doc. The stock table allows inline edit of name / SKU / min stock and on-hand (on-hand posts an `adjustment` movement).

### `inventory_movements/{id}`

Session-scoped log (also stamped with `sessionId`):

| type | Effect |
| --- | --- |
| `stock_in` | Receive goods (supplier invoice confirm or manual) |
| `stock_out` | Consume (sales invoice with linked product, or manual) |
| `stock_restore` | Reverse a cancelled / deleted sales invoice |
| `adjustment` | Correction (positive adds a layer; negative consumes FIFO) |

Costs are stored in **cents**. FIFO consumes oldest `stock_in` / `stock_restore` layers first. Reporting currency (CHF or GBP) is `valuationCents / 100`. Single movements can be deleted from the product history row.

Indexes: `restaurantId` + `name` / `sessionId` (products), `restaurantId` + `date` / `sessionId` (movements). Client filters by session so missing composite indexes do not break the tab.

Dashboard: Income | Expenses | Inventory product-card column (when inventory gate is on). Reports show session stock asset (1200) plus period FIFO COGS / food-cost %.

## Flows

### 1. Product catalog (Inventory tab)

Add products with optional SKU, unit, category/subcategory, min stock. Table shows qty in, qty out, remaining, average unit cost, FIFO value. Expand a row for movement history. Manual stock-in / stock-out / adjustment is available.

### 2. Sales invoice decrement / restore

Invoices stay in localStorage (`paystack_invoices_{uid}`). Optional **Link inventory product** on each line (only when the tab is visible).

- Save / send → `stock_out` for linked qty (diffed against the previous saved invoice)
- Edit qty down, cancel, or delete → `stock_restore`

Unlinked lines do not touch stock.

### 3. Supplier documents increase stock

Documents → **Stocks** filter (same gate). Open a supplier invoice → **Apply to stock**:

- Tag as a stock document (`stockDocument` / `uploadIntent: stock`, or inventory expense categories: food, beverages, restaurant supplies, packaging)
- Match line items to products (SKU / name)
- Confirm → `stock_in` at the line unit cost
- Confirming again replaces that document’s previous stock-in rows

No confirm → no stock change. VAT verification is unchanged.

### 4. Dashboard + reports (konto 1200)

When the tab is visible:

- Dashboard KPI: FIFO stock asset
- Reports: balance-sheet card **1200 · Inventories**
- Excel / PDF export: extra line `1200 Inventories (FIFO)` after the VAT summary

This is an **asset**, not P&L. Income, expenses, and the Swiss/UK VAT statement are not altered.

## UK

`/admin-uk` always has the inventory tab. Same products/movements in the UK Firestore database. Currency suffix GBP. FIFO maths are currency-agnostic (cents).

## Out of scope (Coming soon)

- POS / Z-reading automatic stock-out
- Barcode scanning
- Purchase orders
- Multi-site / warehouse locations
- Promoting the tab to all `/app` users (wait for explicit approval after UAT)

## Files

- Gate: `shared/inventoryAccess.ts`, `client/src/cafe/hooks/useInventoryAllowed.ts`
- FIFO: `shared/inventoryFifo.ts`
- Stock documents: `shared/inventoryStock.ts`
- UI: `InventoryPanel`, `StockConfirmPanel`, sidebar + dashboard + reports in `RestaurantDashboard`
- Rules / indexes: `firestore.rules`, `firestore.indexes.json`
- Tests: `test/inventoryFifo.test.ts`, `test/inventoryAccess.test.ts`
