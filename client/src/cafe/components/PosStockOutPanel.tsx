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
  type SuggestedStockOutLine,
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

function parsePositiveNumber(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function PosStockOutPanel({ doc }: { doc: ProcessedDocument }) {
  const { t } = useLanguage();
  const inventory = useInventoryOptional();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const products = inventory?.products ?? [];
  const recipes = inventory?.recipes ?? [];
  const [rows, setRows] = useState<SuggestedStockOutLine[]>(() =>
    buildRows(doc, products, recipes)
  );

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

  const patchRow = (idx: number, patch: Partial<SuggestedStockOutLine>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

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
      <p className="text-[11px] text-cdlp-muted">
        {t("invPosStockEditHint") ||
          "AI suggested these values — edit any line, then confirm, or leave without applying."}
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-cdlp-muted">
          {t("invPosNoSoldLines") ||
            "No sold product lines found — Z-totals without items cannot auto-decrement. Upload itemized tickets or a Z2 sheet with articles."}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-cdlp-muted px-0.5">
            <div className="col-span-3">{t("invColProduct") || "Description"}</div>
            <div className="col-span-2">{t("invPosSoldQty") || "Sold qty"}</div>
            <div className="col-span-3">{t("invPosInvQty") || "Stock out qty"}</div>
            <div className="col-span-4">{t("invColLinkProduct") || "Product"}</div>
          </div>
          {rows.map((row, idx) => (
            <div
              key={`stock-out-${idx}`}
              className="grid grid-cols-12 gap-2 items-center text-xs"
            >
              <div className="col-span-12 sm:col-span-3">
                <input
                  type="text"
                  className="ba-verify-field text-xs w-full"
                  value={row.description}
                  onChange={(e) => patchRow(idx, { description: e.target.value })}
                  aria-label={t("invColProduct") || "Description"}
                />
                {row.matchedVia === "recipe" ? (
                  <span className="text-[10px] text-cdlp-gold">
                    ({t("invPosViaRecipe") || "recipe"})
                  </span>
                ) : null}
              </div>
              <div className="col-span-6 sm:col-span-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="ba-verify-field text-xs w-full"
                  value={row.soldQty || ""}
                  onChange={(e) => {
                    const soldQty = parsePositiveNumber(e.target.value);
                    // Keep inventory qty in sync only when still at recipe/default ratio
                    // would be ambiguous — just update soldQty; user edits stock-out qty separately.
                    patchRow(idx, { soldQty });
                  }}
                  aria-label={t("invPosSoldQty") || "Sold qty"}
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="ba-verify-field text-xs w-full"
                  value={row.quantity || ""}
                  onChange={(e) =>
                    patchRow(idx, { quantity: parsePositiveNumber(e.target.value) })
                  }
                  aria-label={t("invPosInvQty") || "Stock out qty"}
                />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <select
                  className="ba-verify-field text-xs w-full"
                  value={row.productId || ""}
                  onChange={(e) => {
                    const product = inventory.products.find(
                      (p) => p.id === e.target.value
                    );
                    const recipe = product
                      ? inventory.recipes.find((rec) => {
                          if (rec.productId !== product.id) return false;
                          const pos = rec.posName.trim().toLowerCase();
                          const desc = row.description.trim().toLowerCase();
                          return (
                            pos === desc ||
                            (pos.length >= 2 &&
                              (desc.includes(pos) || pos.includes(desc)))
                          );
                        }) ||
                        inventory.recipes.find((rec) => rec.productId === product.id)
                      : undefined;
                    const qtyPer =
                      recipe && recipe.qtyPerUnit > 0 ? recipe.qtyPerUnit : 1;
                    patchRow(idx, {
                      productId: product?.id,
                      productName: product?.name,
                      matchedVia: recipe
                        ? "recipe"
                        : product
                          ? "name"
                          : "none",
                      // Remap inventory qty from sold qty via recipe; user can override after.
                      quantity: product ? row.soldQty * qtyPer : row.soldQty,
                    });
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
