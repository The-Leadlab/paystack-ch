import { useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabHolding } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useAliLabLedger } from "../hooks/useAliLabLedger";

export function InvestmentsPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const ledger = useAliLabLedger();
  const { items, add, remove, update } = useAliLabPersist<LabHolding>(labCollections.holdings, "holdings", []);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(100);

  const total = items.reduce((s, h) => s + h.quantity * h.lastPriceChf, 0);
  const cost = items.reduce((s, h) => s + h.quantity * h.costBasisChf, 0);
  const pl = total - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  const vsOperating = useMemo(() => {
    if (ledger.balance === 0) return null;
    return (total / Math.abs(ledger.balance)) * 100;
  }, [total, ledger.balance]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      {vsOperating != null && Number.isFinite(vsOperating) && (
        <p className="text-xs text-muted-foreground">
          Portfolio vs operating balance: <strong>{vsOperating.toFixed(1)}%</strong> of session net ({ledger.balance.toLocaleString("de-CH")} CHF)
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        <input className="border border-border rounded px-2 py-1 w-20" placeholder="NESN" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        <input className="border border-border rounded px-2 py-1 flex-1" placeholder="Nestlé" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" className="border border-border rounded px-2 py-1 w-16" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <input type="number" className="border border-border rounded px-2 py-1 w-24" placeholder="Price" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
          onClick={() => {
            if (!symbol.trim()) return;
            void add({
              symbol: symbol.toUpperCase(),
              name: name || symbol,
              quantity: qty,
              costBasisChf: price,
              lastPriceChf: price,
            });
            setSymbol("");
            setName("");
          }}
        >
          Add
        </button>
      </div>
      <p className="text-sm">
        Portfolio: <strong>{total.toLocaleString("de-CH")} CHF</strong> (cost {cost.toLocaleString("de-CH")}, P/L{" "}
        <span className={pl >= 0 ? "text-emerald-600" : "text-red-500"}>
          {pl.toLocaleString("de-CH")} ({plPct.toFixed(1)}%)
        </span>
        )
      </p>
      <ul className="text-sm space-y-2">
        {items.map((h) => {
          const mv = h.quantity * h.lastPriceChf;
          const weight = total > 0 ? (mv / total) * 100 : 0;
          const rowPl = mv - h.quantity * h.costBasisChf;
          return (
            <li key={h.id} className="border border-border rounded px-2 py-2">
              <div className="flex justify-between items-center">
                <span>
                  {h.symbol} · {h.name} — {h.quantity} × {h.lastPriceChf} CHF
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] underline"
                    onClick={() => {
                      const next = prompt("New price CHF", String(h.lastPriceChf));
                      if (next != null) void update(h.id, { lastPriceChf: Number(next) || h.lastPriceChf });
                    }}
                  >
                    {t("updatePrice")}
                  </button>
                  <button type="button" className="text-[10px] underline text-red-500" onClick={() => void remove(h.id)}>
                    {t("delete")}
                  </button>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-brand-red" style={{ width: `${weight}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {t("portfolioWeight")} {weight.toFixed(0)}% · P/L {rowPl.toLocaleString("de-CH")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
