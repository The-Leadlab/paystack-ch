/**
 * Decide which uploaded documents should feed inventory stock_in (purchases),
 * vs POS sales / income which must not inflate on-hand stock.
 */

import { classifyDocumentDirection, type DocumentDirectionInput } from "./documentDirection";
import { isPosSalesDocument } from "./inventoryPosStock";
import { isStockDocument, type StockDocumentLike } from "./inventoryStock";

export type StockInCandidateInput = StockDocumentLike &
  DocumentDirectionInput & {
    documentType?: string | null;
  };

/**
 * True when this document should contribute supplier stock_in lines after Analyze.
 * POS tickets and income/salary docs are excluded; stock-tagged and expense purchases included.
 */
export function isStockInCandidateDocument(
  data: StockInCandidateInput | null | undefined
): boolean {
  if (!data) return false;
  if (isPosSalesDocument(data)) return false;
  if (isStockDocument(data)) return true;

  const flow = classifyDocumentDirection(data);
  if (flow === "INCOME" || flow === "SALARY") return false;
  return flow === "EXPENSE" || flow === "MIXED";
}

/**
 * Normalize verification-center lines for stock_in suggestions.
 * Missing quantity with a positive amount → qty 1 (common on supplier totals).
 */
export function normalizeLinesForStockInAnalyze(
  lines: Array<{
    description?: string;
    quantity?: number | null;
    unitPrice?: number | null;
    amount?: number;
    type?: string;
  }>
): Array<{
  description: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
}> {
  const out: Array<{
    description: string;
    quantity: number;
    unitPrice: number | null;
    amount: number;
  }> = [];
  for (const line of lines) {
    const description = String(line.description || "").trim();
    if (!description) continue;
    const type = String(line.type || "").toUpperCase();
    if (type === "INCOME") continue;
    const amount = Number(line.amount) || 0;
    let quantity =
      line.quantity != null && Number.isFinite(Number(line.quantity))
        ? Number(line.quantity)
        : NaN;
    if (!(quantity > 0)) {
      if (amount > 0) quantity = 1;
      else continue;
    }
    let unitPrice =
      line.unitPrice != null && Number.isFinite(Number(line.unitPrice))
        ? Number(line.unitPrice)
        : null;
    if (unitPrice == null && quantity > 0 && amount > 0) {
      unitPrice = amount / quantity;
    }
    if (unitPrice == null || !Number.isFinite(unitPrice)) continue;
    out.push({ description, quantity, unitPrice, amount });
  }
  return out;
}
