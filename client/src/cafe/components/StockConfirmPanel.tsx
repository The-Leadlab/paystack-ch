import React, { useEffect, useMemo, useState } from "react";
import { Check, Construction, Package } from "lucide-react";
import { toast } from "sonner";
import { useInventoryOptional } from "../context/InventoryContext";
import { useLanguage } from "../context/LanguageContext";
import { collectProductLinesFromDocument } from "../lib/documentProductLines";
import { isStockDocument, suggestStockInFromLines } from "@shared/inventoryStock";
import type { SuggestedStockInLine } from "@shared/inventoryStock";
import type { FinancialData, ProcessedDocument } from "../types";

function buildRows(doc: ProcessedDocument, products: { id: string; name: string; sku?: string }[]) {
  return suggestStockInFromLines(
    collectProductLinesFromDocument(doc).map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    })),
    products
  );
}

function parsePositiveNumber(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function StockConfirmPanel({
  doc,
  onUpdate,
}: {
  doc: ProcessedDocument;
  onUpdate?: (data: FinancialData) => void;
}) {
  const { t } = useLanguage();
  const inventory = useInventoryOptional();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const products = inventory?.products ?? [];
  const [rows, setRows] = useState<SuggestedStockInLine[]>(() => buildRows(doc, products));

  // Remount-safe: rebuild suggestions when document or catalog changes.
  useEffect(() => {
    setRows(buildRows(doc, products));
    setMessage(null);
  }, [doc.id, products.length, doc.data?.lineItems?.length, doc.data?.subDocuments?.length]);

  const alreadyApplied = useMemo(
    () => (inventory?.movements || []).some((m) => m.documentId === doc.id && m.type === "stock_in"),
    [inventory?.movements, doc.id]
  );

  const patchRow = (idx: number, patch: Partial<SuggestedStockInLine>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  if (!inventory) return null;
  const data = doc.data;
  if (!data) return null;

  const tagged = isStockDocument(data);

  const applyStock = async () => {
    const ready = rows.filter((r) => r.productId && r.quantity > 0);
    if (ready.length === 0) {
      const msg = t("invStockNeedProduct") || "Link each line to a product, then confirm.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await inventory.deleteMovementsByDocument(doc.id);
      const date = data.date || new Date().toISOString().slice(0, 10);
      await inventory.addMovementsBatch(
        ready.map((r) => ({
          productId: r.productId!,
          productName: r.productName || r.description,
          type: "stock_in" as const,
          quantity: r.quantity,
          unitCost: r.unitCostCents,
          totalCost: r.unitCostCents * r.quantity,
          documentId: doc.id,
          date,
          note: r.description,
        }))
      );
      onUpdate?.({ ...data, stockDocument: true });
      const ok = t("invStockApplied") || "Stock increased from this supplier invoice.";
      setMessage(ok);
      toast.success(ok);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ba-panel space-y-3 mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-cdlp-white">
          <Package className="w-4 h-4" />
          {t("invStockConfirmTitle") || "Apply to stock"}
        </div>
        {alreadyApplied ? (
          <span className="text-[10px] uppercase tracking-wide text-green-400">
            {t("invStockAlreadyApplied") || "Already applied"}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-cdlp-muted">
        {t("invStockConfirmHint") ||
          "Confirm the supplier invoice lines below to increase on-hand quantity. Unmatched lines stay skipped."}
      </p>
      <p className="text-[11px] text-cdlp-muted">
        {t("invStockEditHint") ||
          "AI suggested these values — edit any line, then confirm, or leave without applying."}
      </p>

      <label className="flex items-center gap-2 text-xs text-cdlp-white">
        <input
          type="checkbox"
          checked={tagged}
          onChange={(e) => onUpdate?.({ ...data, stockDocument: e.target.checked })}
        />
        {t("invMarkStockDocument") || "This is a stock / supplier inventory invoice"}
      </label>

      {!tagged ? (
        <p className="text-[11px] text-amber-400/90">
          {t("invTagStockHint") ||
            "Tick the box above so this document appears under Documents → Stocks and counts as a purchase for konto 1200."}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-cdlp-muted">
          <Construction className="w-3.5 h-3.5" />
          {t("invStockNoLines") ||
            "No quantity line items found — add qty on the invoice lines, or record a movement manually."}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-cdlp-muted px-0.5">
            <div className="col-span-4">{t("invColProduct") || "Description"}</div>
            <div className="col-span-2">{t("invColQty") || "Qty"}</div>
            <div className="col-span-2">{t("invColUnitCost") || "Unit cost"}</div>
            <div className="col-span-4">{t("invColLinkProduct") || "Product"}</div>
          </div>
          {rows.map((row, idx) => (
            <div key={`stock-in-${idx}`} className="grid grid-cols-12 gap-2 items-center text-xs">
              <div className="col-span-12 sm:col-span-4">
                <input
                  type="text"
                  className="ba-verify-field text-xs w-full"
                  value={row.description}
                  onChange={(e) => patchRow(idx, { description: e.target.value })}
                  aria-label={t("invColProduct") || "Description"}
                />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="ba-verify-field text-xs w-full"
                  value={row.quantity || ""}
                  onChange={(e) => patchRow(idx, { quantity: parsePositiveNumber(e.target.value) })}
                  aria-label={t("invColQty") || "Qty"}
                />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="ba-verify-field text-xs w-full"
                  value={
                    Number.isFinite(row.unitCostCents) ? (row.unitCostCents / 100).toFixed(2) : ""
                  }
                  onChange={(e) => {
                    const units = parsePositiveNumber(e.target.value);
                    patchRow(idx, { unitCostCents: Math.round(units * 100) });
                  }}
                  aria-label={t("invColUnitCost") || "Unit cost"}
                />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <select
                  className="ba-verify-field text-xs w-full"
                  value={row.productId || ""}
                  onChange={(e) => {
                    const product = inventory.products.find((p) => p.id === e.target.value);
                    patchRow(idx, {
                      productId: product?.id,
                      productName: product?.name,
                    });
                  }}
                >
                  <option value="">{t("invStockSkipLine") || "Skip — no product"}</option>
                  {inventory.products
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sku ? ` (${p.sku})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || inventory.products.filter((p) => !p.archived).length === 0}
          onClick={() => void applyStock()}
          className="ba-btn-approve flex items-center gap-1.5 text-xs !h-8"
        >
          <Check className="w-3.5 h-3.5" />
          {busy ? t("invSaving") : t("invStockConfirmCta")}
        </button>
        {inventory.products.filter((p) => !p.archived).length === 0 ? (
          <span className="text-[11px] text-amber-400">
            {t("invStockAddProductsFirst") || "Add products in the Inventory tab first."}
          </span>
        ) : null}
      </div>
      {message ? <p className="text-xs text-cdlp-gold">{message}</p> : null}
    </div>
  );
}
