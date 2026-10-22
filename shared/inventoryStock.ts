/**
 * Helpers for treating supplier documents as stock invoices.
 * Inventory-group expense categories (food, beverages, supplies, packaging)
 * plus an explicit `stockDocument` flag.
 */

export const STOCK_EXPENSE_CATEGORIES = [
  "FOOD_SUPPLIES",
  "BEVERAGES",
  "RESTAURANT_SUPPLIES",
  "PACKAGING",
] as const;

export type StockDocumentLike = {
  stockDocument?: boolean;
  uploadIntent?: string | null;
  expenseCategory?: string | null;
  documentType?: string | null;
};

export function isStockDocument(data: StockDocumentLike | null | undefined): boolean {
  if (!data) return false;
  if (data.stockDocument === true) return true;
  if (data.uploadIntent === "stock") return true;
  const cat = String(data.expenseCategory || "").toUpperCase();
  return (STOCK_EXPENSE_CATEGORIES as readonly string[]).includes(cat);
}

export type MatchableProduct = {
  id: string;
  name: string;
  sku?: string;
};

export function matchInventoryProduct(
  description: string | null | undefined,
  products: MatchableProduct[]
): MatchableProduct | null {
  const needle = String(description || "").trim().toLowerCase();
  if (!needle || products.length === 0) return null;

  const skuHit = products.find((p) => p.sku && needle.includes(p.sku.trim().toLowerCase()));
  if (skuHit) return skuHit;

  const exact = products.find((p) => p.name.trim().toLowerCase() === needle);
  if (exact) return exact;

  const contains = products.find((p) => {
    const name = p.name.trim().toLowerCase();
    return name.length >= 3 && (needle.includes(name) || name.includes(needle));
  });
  return contains ?? null;
}

export type SuggestedStockInLine = {
  description: string;
  quantity: number;
  unitCostCents: number;
  productId?: string;
  productName?: string;
};

export function suggestStockInFromLines(
  lines: Array<{
    description?: string;
    quantity?: number | null;
    unitPrice?: number | null;
    amount?: number;
  }>,
  products: MatchableProduct[]
): SuggestedStockInLine[] {
  const out: SuggestedStockInLine[] = [];
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!(qty > 0)) continue;
    const unit = line.unitPrice != null ? Number(line.unitPrice) : Number(line.amount || 0) / qty;
    if (!Number.isFinite(unit)) continue;
    const matched = matchInventoryProduct(line.description, products);
    out.push({
      description: String(line.description || "").trim() || "Line",
      quantity: qty,
      unitCostCents: Math.round(unit * 100),
      productId: matched?.id,
      productName: matched?.name,
    });
  }
  return out;
}
