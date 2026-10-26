import React, { useEffect, useMemo, useState } from "react";
import { Check, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import { useInventoryOptional } from "../context/InventoryContext";
import { useLanguage } from "../context/LanguageContext";
import { collectProductLinesFromDocument } from "../lib/documentProductLines";
import {
  aggregateStockOutByProduct,
  isPosSalesDocument,
  suggestStockOutFromPosLines,
} from "@shared/inventoryPosStock";
import type { ProcessedDocument } from "../types";

function buildRows(
  doc: ProcessedDocument,
  products: { id: string; name: string; sku?: string; archived?: boolean }[],
  recipes: { posName: string; productId: string; qtyPerUnit: number }[]
) {
  const active = products.filter((p) => !p.archived);
  return suggestStockOutFromPosLines(
    collectProductLinesFromDocument(doc).map((line) => ({
      description: line.description,
      quantity: line.quantity,
      amount: line.amount,
    })),
    active,
    recipes
  );
}

export function PosStockOutPanel({ doc }: { doc: ProcessedDocument }) {
  const { t } = useLanguage();
  const inventory = useInventoryOptional();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const products = inventory?.products ?? [];
  const recipes = inventory?.recipes ?? [];
  const [rows, setRows] = useState(() => buildRows(doc, products, recipes));

  useEffect(() => {
    setRows(buildRows(doc, products, recipes));
    setMessage(null);
  }, [
    doc.id,
    products.length,
    recipes.length,
    doc.data?.lineItems?.length,
    doc.data?.subDocuments?.length,
  ]);

  const alreadyApplied = useMemo(
    () =>
      (inventory?.movements || []).some(
        (m) => m.documentId === doc.id && m.type === "stock_out"
      ),
    [inventory?.movements, doc.id]
  );

  if (!inventory || !isPosSalesDocument(doc.data)) return null;

  const applyStockOut = async () => {
    const ready = rows.filter((r) => r.productId && r.quantity > 0);
    if (ready.length === 0) {
      const msg =
        t("invPosNeedProduct") ||
        "Link sold lines to products (or add POS recipes), then confirm.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await inventory.deleteMovementsByDocument(doc.id);
      const aggregated = aggregateStockOutByProduct(ready);
      const date = doc.data?.date || new Date().toISOString().slice(0, 10);
      await inventory.addMovementsBatch(
        aggregated.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          type: "stock_out" as const,
          quantity: r.quantity,
          documentId: doc.id,
          date,
          note: `POS: ${r.note}`,
        }))
      );
      const ok =
        t("invPosStockApplied") ||
        "Stock decreased from this till ticket / Z2 sheet.";
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
          <PackageMinus className="w-4 h-4" />
          {t("invPosStockOutTitle") || "Apply POS stock-out"}
        </div>
        {alreadyApplied ? (
          <span className="text-[10px] uppercase tracking-wide text-amber-400">
            {t("invPosAlreadyApplied") || "Stock-out already applied"}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-cdlp-muted">
        {t("invPosStockOutHint") ||
          "Confirm sold lines to decrease on-hand (FIFO). Map till names in Stock → POS recipes for coffee beans, milk, etc. Payment lines are skipped."}
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-cdlp-muted">
          {t("invPosNoSoldLines") ||
            "No sold product lines found — Z-totals without items cannot auto-decrement. Upload itemized tickets or a Z2 sheet with articles."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div
              key={`${row.description}-${idx}`}
              className="grid grid-cols-12 gap-2 items-center text-xs"
            >
              <div
                className="col-span-12 sm:col-span-4 text-cdlp-white truncate"
                title={row.description}
              >
                {row.description} × {row.soldQty}
                {row.matchedVia === "recipe" ? (
                  <span className="text-cdlp-gold ml-1">
                    ({t("invPosViaRecipe") || "recipe"})
                  </span>
                ) : null}
              </div>
              <div className="col-span-12 sm:col-span-5">
                <select
                  className="ba-verify-field text-xs"
                  value={row.productId || ""}
                  onChange={(e) => {
                    const product = inventory.products.find(
                      (p) => p.id === e.target.value
                    );
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === idx
                          ? {
                              ...r,
                              productId: product?.id,
                              productName: product?.name,
                              matchedVia: product ? "name" : "none",
                              quantity: r.soldQty,
                            }
                          : r
                      )
                    );
                  }}
                >
                  <option value="">
                    {t("invStockSkipLine") || "Skip — no product"}
                  </option>
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
              <div className="col-span-12 sm:col-span-3 text-cdlp-muted">
                → {row.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}{" "}
                {t("invColUnit") || "units"}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || inventory.products.filter((p) => !p.archived).length === 0}
          onClick={() => void applyStockOut()}
          className="ba-btn-approve flex items-center gap-1.5 text-xs !h-8"
        >
          <Check className="w-3.5 h-3.5" />
          {busy ? t("invSaving") : t("invPosStockOutCta") || "Confirm stock out"}
        </button>
        {inventory.recipes.length === 0 ? (
          <span className="text-[11px] text-cdlp-muted">
            {t("invPosAddRecipesHint") ||
              "Tip: add POS recipes under Stock for accurate ingredient qty."}
          </span>
        ) : null}
      </div>
      {message ? <p className="text-xs text-cdlp-gold">{message}</p> : null}
    </div>
  );
}
