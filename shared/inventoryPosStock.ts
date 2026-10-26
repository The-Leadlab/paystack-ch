/**
 * Phase 2: map POS / Ticket / Z2 sold lines → inventory stock_out quantities.
 * Recipes: POS line name → productId × qtyPerUnit (inventory units per 1 sold unit).
 */

import {
  matchInventoryProduct,
  normalizeMatchText,
  type MatchableProduct,
} from "./inventoryStock";

export type PosRecipe = {
  id?: string;
  posName: string;
  productId: string;
  /** Inventory units consumed per 1 sold unit (default 1). */
  qtyPerUnit: number;
};

export type SuggestedStockOutLine = {
  description: string;
  soldQty: number;
  quantity: number;
  productId?: string;
  productName?: string;
  matchedVia: "recipe" | "name" | "none";
};

/** Payment / till close lines that must never decrement stock. */
const NON_PRODUCT_LINE =
  /\b(cash|espèces|especes|carte|card|visa|mastercard|amex|twint|tips?|pourboire|discount|remise|rabais|refund|remboursement|total|sous[- ]?total|subtotal|tva|vat|mwst|change|rendu|net\s*sales|gross\s*sales|clôture|cloture|z[- ]?reading|z[- ]?bon)\b/i;

export function isNonProductPosLine(description: string | null | undefined): boolean {
  const d = String(description || "").trim();
  if (!d) return true;
  return NON_PRODUCT_LINE.test(d);
}

export function isPosSalesDocument(data: {
  documentType?: string | null;
} | null | undefined): boolean {
  if (!data?.documentType) return false;
  return (
    data.documentType === "Ticket/Receipt" || data.documentType === "Z2 Multi-Ticket Sheet"
  );
}

function findRecipe(
  description: string,
  recipes: PosRecipe[]
): PosRecipe | null {
  const needle = description.trim().toLowerCase();
  const needleNorm = normalizeMatchText(description);
  if (!needleNorm || recipes.length === 0) return null;
  const exact = recipes.find((r) => r.posName.trim().toLowerCase() === needle);
  if (exact) return exact;
  const exactNorm = recipes.find(
    (r) => normalizeMatchText(r.posName) === needleNorm
  );
  if (exactNorm) return exactNorm;
  return (
    recipes.find((r) => {
      const nameNorm = normalizeMatchText(r.posName);
      return (
        nameNorm.length >= 2 &&
        (needleNorm.includes(nameNorm) || nameNorm.includes(needleNorm))
      );
    }) ?? null
  );
}

/**
 * Suggest stock_out rows from sold POS lines.
 * Prefer recipe map; fall back to inventory product name/SKU match with qtyPerUnit = 1.
 */
export function suggestStockOutFromPosLines(
  lines: Array<{
    description?: string;
    quantity?: number | null;
    amount?: number;
  }>,
  products: MatchableProduct[],
  recipes: PosRecipe[]
): SuggestedStockOutLine[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const out: SuggestedStockOutLine[] = [];

  for (const line of lines) {
    const description = String(line.description || "").trim() || "Line";
    if (isNonProductPosLine(description)) continue;

    let soldQty = Number(line.quantity);
    if (!(soldQty > 0)) {
      // Ticket lines sometimes omit qty — treat as 1 if amount present
      if (Number(line.amount) > 0) soldQty = 1;
      else continue;
    }

    const recipe = findRecipe(description, recipes);
    if (recipe) {
      const product = productById.get(recipe.productId);
      const qtyPer = recipe.qtyPerUnit > 0 ? recipe.qtyPerUnit : 1;
      out.push({
        description,
        soldQty,
        quantity: soldQty * qtyPer,
        productId: recipe.productId,
        productName: product?.name,
        matchedVia: "recipe",
      });
      continue;
    }

    const matched = matchInventoryProduct(description, products);
    out.push({
      description,
      soldQty,
      quantity: soldQty,
      productId: matched?.id,
      productName: matched?.name,
      matchedVia: matched ? "name" : "none",
    });
  }

  return out;
}

/** Collapse multiple lines for the same product into one stock_out quantity. */
export function aggregateStockOutByProduct(
  rows: SuggestedStockOutLine[]
): Array<{ productId: string; productName: string; quantity: number; note: string }> {
  const map = new Map<
    string,
    { productId: string; productName: string; quantity: number; notes: string[] }
  >();
  for (const row of rows) {
    if (!row.productId || !(row.quantity > 0)) continue;
    const prev = map.get(row.productId);
    if (prev) {
      prev.quantity += row.quantity;
      prev.notes.push(row.description);
    } else {
      map.set(row.productId, {
        productId: row.productId,
        productName: row.productName || row.description,
        quantity: row.quantity,
        notes: [row.description],
      });
    }
  }
  return [...map.values()].map((r) => ({
    productId: r.productId,
    productName: r.productName,
    quantity: r.quantity,
    note: r.notes.slice(0, 3).join("; "),
  }));
}
