/**
 * Single session inventory snapshot for Dashboard, Reports, exports, and email.
 * Stock numbers stay in sync across the platform by reading this helper everywhere.
 */

import {
  computeFifo,
  foodCostPercent,
  periodFifoCogsCents,
  valuationInCurrency,
  type FifoMovement,
} from "./inventoryFifo.js";

export type SnapshotProduct = {
  id: string;
  name: string;
  sku?: string;
  unit?: string;
  category?: string;
  archived?: boolean;
  /** Denormalised on-hand (optional; recomputed from movements when present). */
  onHandQty?: number;
  /** FIFO valuation in cents (optional; recomputed when movements exist). */
  valuationAmount?: number;
};

export type SnapshotMovement = FifoMovement & {
  productId: string;
  productName?: string;
  documentId?: string;
};

export type InventoryProductRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string;
  onHandQty: number;
  valuation: number;
};

export type InventoryMovementRow = {
  id: string;
  date: string;
  type: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  documentId: string;
};

export type SessionInventorySnapshot = {
  /** FIFO asset value in reporting currency (konto 1200). */
  valuation: number;
  valuationCents: number;
  /** Period COGS in reporting currency. */
  periodCogs: number;
  periodCogsCents: number;
  foodCostPercent: number | null;
  productRows: InventoryProductRow[];
  movementRows: InventoryMovementRow[];
  movementCount: number;
};

function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function firstDayOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}

function groupMovementsByProduct(
  movements: SnapshotMovement[]
): Map<string, SnapshotMovement[]> {
  const map = new Map<string, SnapshotMovement[]>();
  for (const m of movements) {
    if (!m.productId) continue;
    const list = map.get(m.productId) || [];
    list.push(m);
    map.set(m.productId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }
  return map;
}

/**
 * Build a platform-wide inventory snapshot for the current catalog + movements.
 * Optional date window scopes period COGS / food cost (valuation stays as-of now /
 * as-of dateTo when provided — movements after dateTo are excluded from valuation).
 */
export function buildSessionInventorySnapshot(opts: {
  products: SnapshotProduct[];
  movements: SnapshotMovement[];
  dateFrom?: string;
  dateTo?: string;
  /** Period income in reporting currency — used for food-cost %. */
  revenueAmount?: number;
}): SessionInventorySnapshot {
  const activeProducts = (opts.products || []).filter((p) => !p.archived);
  const asOf = opts.dateTo || undefined;
  const movementsForValuation = (opts.movements || []).filter((m) => {
    if (asOf && m.date > asOf) return false;
    return true;
  });
  const byProduct = groupMovementsByProduct(movementsForValuation);

  const productRows: InventoryProductRow[] = [];
  let valuationCents = 0;

  for (const p of activeProducts) {
    const mvs = byProduct.get(p.id) || [];
    let onHand = Number(p.onHandQty) || 0;
    let valCents = Number(p.valuationAmount) || 0;
    if (mvs.length > 0) {
      const fifo = computeFifo(mvs);
      onHand = fifo.onHandQty;
      valCents = fifo.valuationAmount;
    } else if (asOf) {
      // No movements in window → empty if we only trust FIFO; keep denormalised only when no asOf.
      onHand = 0;
      valCents = 0;
    }
    valuationCents += valCents;
    productRows.push({
      id: p.id,
      name: p.name,
      sku: p.sku || "",
      unit: p.unit || "pcs",
      category: p.category || "",
      onHandQty: onHand,
      valuation: valuationInCurrency(valCents),
    });
  }

  productRows.sort((a, b) => a.name.localeCompare(b.name));

  const periodCogsCents = periodFifoCogsCents(opts.movements || [], {
    fromDate: opts.dateFrom,
    toDate: opts.dateTo,
  });
  const revenue = Number(opts.revenueAmount) || 0;

  const movementRows: InventoryMovementRow[] = (opts.movements || [])
    .filter((m) => {
      if (opts.dateFrom && m.date < opts.dateFrom) return false;
      if (opts.dateTo && m.date > opts.dateTo) return false;
      return true;
    })
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map((m) => ({
      id: m.id,
      date: m.date,
      type: m.type,
      productId: m.productId,
      productName: m.productName || "",
      quantity: m.quantity,
      unitCost: m.unitCost ?? 0,
      documentId: m.documentId || "",
    }));

  return {
    valuationCents,
    valuation: valuationInCurrency(valuationCents),
    periodCogsCents,
    periodCogs: valuationInCurrency(periodCogsCents),
    foodCostPercent: foodCostPercent(periodCogsCents, revenue),
    productRows,
    movementRows,
    movementCount: movementRows.length,
  };
}

/**
 * Per-month COGS and end-of-month valuation for monthly analysis rows.
 */
export function monthlyInventorySeries(opts: {
  products: SnapshotProduct[];
  movements: SnapshotMovement[];
  /** YYYY-MM keys */
  months: string[];
}): Map<string, { valuation: number; cogs: number }> {
  const out = new Map<string, { valuation: number; cogs: number }>();
  for (const month of opts.months) {
    const from = firstDayOfMonth(month);
    const to = lastDayOfMonth(month);
    const snap = buildSessionInventorySnapshot({
      products: opts.products,
      movements: opts.movements,
      dateFrom: from,
      dateTo: to,
    });
    out.set(month, { valuation: snap.valuation, cogs: snap.periodCogs });
  }
  return out;
}
