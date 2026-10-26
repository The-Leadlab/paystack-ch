# Inventory / stock plan (hidden tab)

For Ali to send Damien ahead of the 28 Oct presentation. Testable from 26 Oct behind a feature gate. Not shown to normal `/app` users.

## What this is

A first slice of inventory for Swiss restaurant books (and the same flag on UK UAT for Louise). Products, quantities in/out/on hand, FIFO cost, sales-invoice stock-out, supplier-invoice stock-in with a manual confirm step, and a balance-sheet stock asset on konto **1200**. VAT flows are unchanged.

POS auto stock-out, barcode scanning, and multi-site warehouses are **Coming soon** — they render as labelled placeholders, not broken screens.

## Who can see it

Hidden unless one of these is true:

1. Built-in emails: `ali@the-leadlab.com`, `damien@the-leadlab.com` (Inventory sidebar tab in `/app`)
2. `VITE_INVENTORY_ENABLED=true` (master switch for demo week)
3. Email on `VITE_INVENTORY_EMAILS` (comma-separated extras)
4. `users/{uid}.inventoryBeta === true`
5. Admin app-access user
6. UK UAT (`/admin-uk`) — Louise tests the same UI in GBP / UK VAT

Do not hardcode Louise’s email in the repo — use env, Firestore beta, admin access, or `/admin-uk`.

## Data model (Firestore)

Collections live next to expenses, scoped by `restaurantId` (workspace owner uid). Same ownership rules as other restaurant collections. UK UAT uses the isolated `admin-uk-uat` database.

### `inventory_products/{id}`

| Field | Meaning |
| --- | --- |
| restaurantId | Workspace owner |
| name, sku, unit | Catalog |
| category, subcategory | Optional; presets by business type (restaurant, garage, retail, general) |
| minStockLevel | Optional low-stock alert |
| archived | Soft hide |

On-hand qty and valuation are **derived from movements** (FIFO), not trusted as source of truth on the product doc.

### `inventory_movements/{id}`

Append-only log:

| type | Effect |
| --- | --- |
| `stock_in` | Receive goods (supplier invoice confirm or manual) |
| `stock_out` | Consume (sales invoice with linked product, or manual) |
| `stock_restore` | Reverse a cancelled / deleted sales invoice |
| `adjustment` | Correction (positive adds a layer; negative consumes FIFO) |

Costs are stored in **cents**. FIFO consumes oldest `stock_in` / `stock_restore` layers first. Reporting currency (CHF or GBP) is `valuationCents / 100`.

Indexes: `restaurantId` + `name` (products), `restaurantId` + `date` (movements). Queries currently filter by `restaurantId` only and sort in the client so missing indexes do not break the tab.

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
