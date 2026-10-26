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

/**
 * Fold accents, drop size notes like "(verre)", collapse punctuation —
 * so till text "Sangria maison (verre)" matches product "Sangria maison".
 */
export function normalizeMatchText(raw: string | null | undefined): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length >= 2));
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.min(ta.size, tb.size);
}

export function matchInventoryProduct(
  description: string | null | undefined,
  products: MatchableProduct[]
): MatchableProduct | null {
  const raw = String(description || "").trim();
  const needle = raw.toLowerCase();
  const needleNorm = normalizeMatchText(raw);
  if (!needleNorm || products.length === 0) return null;

  const skuHit = products.find(
    (p) => p.sku && needle.includes(p.sku.trim().toLowerCase())
  );
  if (skuHit) return skuHit;

  const exact = products.find((p) => p.name.trim().toLowerCase() === needle);
  if (exact) return exact;

  const exactNorm = products.find(
    (p) => normalizeMatchText(p.name) === needleNorm
  );
  if (exactNorm) return exactNorm;

  // Prefer longest contains match (normalized)
  let bestContains: MatchableProduct | null = null;
  let bestLen = 0;
  for (const p of products) {
    const nameNorm = normalizeMatchText(p.name);
    if (nameNorm.length < 3) continue;
    if (needleNorm.includes(nameNorm) || nameNorm.includes(needleNorm)) {
      if (nameNorm.length > bestLen) {
        bestContains = p;
        bestLen = nameNorm.length;
      }
    }
  }
  if (bestContains) return bestContains;

  // Token overlap (e.g. "Patatas bravas XL" ↔ "Patatas bravas")
  let bestFuzzy: MatchableProduct | null = null;
  let bestScore = 0;
  for (const p of products) {
    const nameNorm = normalizeMatchText(p.name);
    const score = tokenOverlapScore(needleNorm, nameNorm);
    if (score >= 0.67 && score > bestScore) {
      bestFuzzy = p;
      bestScore = score;
    }
  }
  return bestFuzzy;
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
