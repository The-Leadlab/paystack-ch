/**
 * FIFO (First-In, First-Out) inventory costing — pure functions, no side effects.
 *
 * Used by:
 *   - Client: real-time valuation in the inventory tab
 *   - Reports: Swiss balance sheet asset line (konto 1200)
 *   - Tests: unit tests for stock maths
 */

export interface FifoLayer {
  id: string;        // movement id
  date: string;      // ISO date
  originalQty: number;
  remainingQty: number;
  unitCost: number;
}

export interface FifoMovement {
  id: string;
  type: 'stock_in' | 'stock_out' | 'adjustment' | 'stock_restore';
  quantity: number;
  unitCost?: number;
  date: string;
}

export interface FifoResult {
  layers: FifoLayer[];
  onHandQty: number;
  valuationAmount: number;
  avgUnitCost: number;
  /** COGS for all consumed layers so far. */
  totalCogs: number;
}

/**
 * Build FIFO layers from a chronologically-sorted list of movements.
 * stock_in  → pushes a new layer
 * stock_out → consumes from oldest layers first
 * stock_restore → re-adds a layer (e.g. cancelled invoice)
 * adjustment → positive adds a layer at zero cost, negative consumes FIFO
 */
export function computeFifo(movements: FifoMovement[]): FifoResult {
  const layers: FifoLayer[] = [];
  let totalCogs = 0;

  for (const m of movements) {
    switch (m.type) {
      case 'stock_in':
      case 'stock_restore': {
        const cost = m.unitCost ?? 0;
        layers.push({
          id: m.id,
          date: m.date,
          originalQty: m.quantity,
          remainingQty: m.quantity,
          unitCost: cost,
        });
        break;
      }
      case 'stock_out': {
        let remaining = m.quantity;
        for (const layer of layers) {
          if (remaining <= 0) break;
          if (layer.remainingQty <= 0) continue;
          const take = Math.min(layer.remainingQty, remaining);
          layer.remainingQty -= take;
          remaining -= take;
          totalCogs += take * layer.unitCost;
        }
        break;
      }
      case 'adjustment': {
        if (m.quantity > 0) {
          layers.push({
            id: m.id,
            date: m.date,
            originalQty: m.quantity,
            remainingQty: m.quantity,
            unitCost: m.unitCost ?? 0,
          });
        } else {
          let remaining = Math.abs(m.quantity);
          for (const layer of layers) {
            if (remaining <= 0) break;
            if (layer.remainingQty <= 0) continue;
            const take = Math.min(layer.remainingQty, remaining);
            layer.remainingQty -= take;
            remaining -= take;
            totalCogs += take * layer.unitCost;
          }
        }
        break;
      }
    }
  }

  const activeLayers = layers.filter((l) => l.remainingQty > 0);
  const onHandQty = activeLayers.reduce((sum, l) => sum + l.remainingQty, 0);
  const valuationAmount = activeLayers.reduce((sum, l) => sum + l.remainingQty * l.unitCost, 0);
  const avgUnitCost = onHandQty > 0 ? valuationAmount / onHandQty : 0;

  return { layers: activeLayers, onHandQty, valuationAmount, avgUnitCost, totalCogs };
}

/**
 * Compute total inventory valuation across multiple products.
 * Returns the sum suitable for the balance sheet konto 1200 line.
 */
export function totalInventoryValuation(
  productMovements: Map<string, FifoMovement[]>
): number {
  let total = 0;
  for (const movements of productMovements.values()) {
    const result = computeFifo(movements);
    total += result.valuationAmount;
  }
  return total;
}

/**
 * Decrement stock for a list of invoice line items.
 * Returns the movements to persist.
 */
export function decrementForInvoiceLines(
  lines: Array<{ productId: string; productName: string; quantity: number }>,
  invoiceId: string,
  date: string,
  restaurantId: string,
): Array<{
  restaurantId: string;
  productId: string;
  productName: string;
  type: 'stock_out';
  quantity: number;
  invoiceId: string;
  date: string;
  createdAt: string;
}> {
  const now = new Date().toISOString();
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      restaurantId,
      productId: l.productId,
      productName: l.productName,
      type: 'stock_out' as const,
      quantity: l.quantity,
      invoiceId,
      date,
      createdAt: now,
    }));
}

/**
 * Restore stock for a cancelled/deleted invoice.
 * Mirrors decrementForInvoiceLines but with type 'stock_restore'.
 */
export function restoreForInvoiceLines(
  lines: Array<{ productId: string; productName: string; quantity: number; unitCost?: number }>,
  invoiceId: string,
  date: string,
  restaurantId: string,
): Array<{
  restaurantId: string;
  productId: string;
  productName: string;
  type: 'stock_restore';
  quantity: number;
  unitCost?: number;
  invoiceId: string;
  date: string;
  createdAt: string;
}> {
  const now = new Date().toISOString();
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      restaurantId,
      productId: l.productId,
      productName: l.productName,
      type: 'stock_restore' as const,
      quantity: l.quantity,
      unitCost: l.unitCost,
      invoiceId,
      date,
      createdAt: now,
    }));
}

/** Convert stored FIFO cents to reporting-currency units (CHF / GBP). */
export function valuationInCurrency(valuationAmountCents: number): number {
  return Math.round((Number(valuationAmountCents) || 0)) / 100;
}

export type InvoiceStockLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitCost?: number;
};

export function aggregateInvoiceStockLines(lines: InvoiceStockLine[]): InvoiceStockLine[] {
  const map = new Map<string, InvoiceStockLine>();
  for (const line of lines) {
    if (!line.productId || !(line.quantity > 0)) continue;
    const prev = map.get(line.productId);
    if (prev) {
      prev.quantity += line.quantity;
      if (line.unitCost != null) prev.unitCost = line.unitCost;
    } else {
      map.set(line.productId, { ...line });
    }
  }
  return Array.from(map.values());
}

/**
 * Diff previous vs next invoice product lines.
 * Positive quantity change → stock_out; negative / cancel / delete → stock_restore.
 */
export function invoiceStockDelta(
  previous: InvoiceStockLine[],
  next: InvoiceStockLine[],
  opts: { previousCancelled?: boolean; nextCancelled?: boolean } = {}
): { outs: InvoiceStockLine[]; restores: InvoiceStockLine[] } {
  const prevAgg = opts.previousCancelled ? [] : aggregateInvoiceStockLines(previous);
  const nextAgg = opts.nextCancelled ? [] : aggregateInvoiceStockLines(next);
  const ids = new Set([...prevAgg.map((l) => l.productId), ...nextAgg.map((l) => l.productId)]);
  const prevMap = new Map(prevAgg.map((l) => [l.productId, l]));
  const nextMap = new Map(nextAgg.map((l) => [l.productId, l]));
  const outs: InvoiceStockLine[] = [];
  const restores: InvoiceStockLine[] = [];

  for (const id of ids) {
    const prev = prevMap.get(id);
    const nxt = nextMap.get(id);
    const prevQty = prev?.quantity ?? 0;
    const nextQty = nxt?.quantity ?? 0;
    const delta = nextQty - prevQty;
    if (delta > 0) {
      outs.push({
        productId: id,
        productName: nxt?.productName || prev?.productName || id,
        quantity: delta,
        unitCost: nxt?.unitCost ?? prev?.unitCost,
      });
    } else if (delta < 0) {
      restores.push({
        productId: id,
        productName: prev?.productName || nxt?.productName || id,
        quantity: -delta,
        unitCost: prev?.unitCost ?? nxt?.unitCost,
      });
    }
  }

  return { outs, restores };
}
