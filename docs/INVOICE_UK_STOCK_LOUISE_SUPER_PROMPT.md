# Invoice Maker + UK / Louise Stock Unlock — Super Prompt

Act as a senior product engineer on Paystack.ch. Fix Invoice Maker number-entry UX, then unlock interactive Inventory/stock for **UK UAT (GBP)** and **Louise** so she can test stock on both the UK sandbox and CHF `/app`.

Related: `docs/INVENTORY_PLAN.md`, `docs/INVENTORY_SWISS_SUPER_PROMPT.md`, `docs/MOBILE_APP_UX_SUPER_PROMPT.md`, Admin UK notes in `AGENTS.md`.

---

## Problems

### 1. Invoice tab — stuck zero in number fields

In **Invoices** (`InvoiceMakerPanel`), quantity / unit price / discount inputs are controlled with `value={n}` and `onChange → Number(e.target.value)`. Clearing the field yields `Number('') === 0`, so a **0 immediately reappears** and operators cannot type cleanly (classic controlled-number bug).

**Fix:** use a draft-string number input (empty allowed while editing; commit finite number on change/blur; empty → `0` for totals only after commit). Apply to line qty, unit price, line discount, and invoice-level discount.

### 2. Invoice tab — quick audit

While touching the panel, check for related issues:

- Same stuck-zero pattern on any other numeric fields
- Qty `min={1}` fighting empty draft (allow empty while typing; treat blank as 0 for math)
- UK tax rates / GBP currency still correct under `/admin-uk`
- Inventory product link still only when stock unlocked
- Save / preview / PDF / send still work after number-input change

Do **not** redesign the invoice UI or change ledger posting unless broken.

### 3. Stock unlock — UK (GBP) + Louise

Full interactive stock is currently **Ali + Damien only** (`shared/inventoryAccess.ts`). Unlock:

| Who / where | Expectation |
|-------------|-------------|
| `/admin-uk` (UK UAT) | Anyone in the UK sandbox gets full stock (GBP / UK VAT / `admin-uk-uat` DB) |
| Louise | On allowlist so she can test stock on **CHF `/app`** and **UK `/admin-uk`** |
| Ali + Damien | Remain unlocked |

Pass `ukUatActive` from `useUkUat()` into `isInventoryAllowedForUser`. Prefer built-in email `louise@the-leadlab.com` (same domain pattern as Ali/Damien). Support `VITE_INVENTORY_EMAILS` for extras without a code change.

Verify mentally: CHF path uses `(default)` Firestore; UK path uses `admin-uk-uat` — unlock is UI/gate only; no schema change.

---

## Agent instructions (paste into chat)

```
Apply docs/INVOICE_UK_STOCK_LOUISE_SUPER_PROMPT.md.

1. Fix Invoice Maker stuck zeros: draft-string number inputs for qty, unit price, line discount, invoice discount.
2. Quick-audit Invoice tab for related number-input bugs; keep UK VAT/GBP behaviour.
3. Unlock full inventory for UK UAT (`ukUatActive`) and Louise (`louise@the-leadlab.com` + existing Ali/Damien). Wire useInventoryAllowed to pass ukUatActive.
4. Update inventoryAccess tests + INVENTORY_PLAN who-can-use section.
5. Do not promote stock to all production users. Do not touch Open Banking / personal Revenue.

Verify: empty invoice amount field stays empty while typing; Louise + /admin-uk see interactive Inventory (not Coming Soon).
```

---

## Acceptance

- [ ] Clearing unit price / qty / discount leaves the field empty so new digits can be typed
- [ ] Totals still compute (empty → 0 after commit); save/preview/PDF unchanged
- [ ] `/admin-uk` → Inventory is interactive (GBP), not Coming Soon
- [ ] Louise’s allowlisted email → Inventory interactive on CHF `/app`
- [ ] Ali + Damien still unlocked; random users still see Coming Soon outside UK UAT
- [ ] `pnpm exec vitest run test/inventoryAccess.test.ts` passes

---

## Out of scope

- Opening stock to every paid customer
- React Native / Capacitor
- Changing FIFO math or Firestore inventory schema
- Marketing landing changes
