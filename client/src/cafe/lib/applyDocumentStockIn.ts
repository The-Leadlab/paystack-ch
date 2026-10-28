import {
  inventoryCategoryFromExpense,
  normalizeMatchText,
  planStockInProduct,
  suggestStockInFromLines,
  type MatchableProduct,
  type SuggestedStockInLine,
} from '@shared/inventoryStock';
import type { FinancialData } from '../types';

export type StockInInventoryApi = {
  products: Array<MatchableProduct & { archived?: boolean }>;
  addProduct: (p: {
    name: string;
    unit: 'pcs';
    category: string;
    subcategory?: string;
  }) => Promise<string>;
  deleteMovementsByDocument: (documentId: string) => Promise<number>;
  addMovementsBatch: (
    ms: Array<{
      productId: string;
      productName: string;
      type: 'stock_in';
      quantity: number;
      unitCost: number;
      totalCost: number;
      documentId: string;
      date: string;
      note: string;
    }>,
  ) => Promise<void>;
};

export type ApplyDocumentStockInResult = {
  linesApplied: number;
  productsCreated: number;
};

/**
 * Create/match catalog products and post stock_in movements for one document
 * (same path as StockConfirmPanel Confirm).
 */
export async function applyDocumentStockIn(opts: {
  documentId: string;
  data: FinancialData;
  rows: SuggestedStockInLine[];
  inventory: StockInInventoryApi;
}): Promise<ApplyDocumentStockInResult> {
  const { documentId, data, rows, inventory } = opts;
  const candidates = rows.filter(
    (r) => !r.skip && r.quantity > 0 && String(r.description || '').trim(),
  );
  if (candidates.length === 0) {
    return { linesApplied: 0, productsCreated: 0 };
  }

  const known: MatchableProduct[] = inventory.products
    .filter((p) => !p.archived)
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
  const knownNorm = new Map(known.map((p) => [normalizeMatchText(p.name), p.id] as const));
  const resolved: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCostCents: number;
    description: string;
  }> = [];
  let productsCreated = 0;

  for (const row of candidates) {
    const plan = planStockInProduct(row, known);
    if (plan.action === 'skip') continue;

    let productId: string;
    let productName: string;

    if (plan.action === 'use') {
      productId = plan.productId;
      productName = plan.productName;
    } else {
      const norm = normalizeMatchText(plan.name);
      const existingId = knownNorm.get(norm);
      if (existingId) {
        productId = existingId;
        productName = plan.name;
      } else {
        productId = await inventory.addProduct({
          name: plan.name,
          unit: 'pcs',
          category: inventoryCategoryFromExpense(data.expenseCategory),
          subcategory: 'From invoice',
        });
        known.push({ id: productId, name: plan.name });
        knownNorm.set(norm, productId);
        productsCreated += 1;
        productName = plan.name;
      }
    }

    resolved.push({
      productId,
      productName,
      quantity: row.quantity,
      unitCostCents: row.unitCostCents,
      description: row.description,
    });
  }

  if (resolved.length === 0) {
    return { linesApplied: 0, productsCreated: 0 };
  }

  await inventory.deleteMovementsByDocument(documentId);
  const date = data.date || new Date().toISOString().slice(0, 10);
  await inventory.addMovementsBatch(
    resolved.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      type: 'stock_in' as const,
      quantity: r.quantity,
      unitCost: r.unitCostCents,
      totalCost: r.unitCostCents * r.quantity,
      documentId,
      date,
      note: r.description,
    })),
  );

  return { linesApplied: resolved.length, productsCreated };
}

export function suggestRowsForDocumentStockIn(
  lines: Array<{
    description?: string;
    quantity?: number | null;
    unitPrice?: number | null;
    amount?: number;
  }>,
  products: MatchableProduct[],
): SuggestedStockInLine[] {
  return suggestStockInFromLines(lines, products);
}
