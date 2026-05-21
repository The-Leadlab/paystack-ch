import { useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabHolding } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";

export function InvestmentsPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { items, add, remove } = useAliLabPersist<LabHolding>(labCollections.holdings, "holdings", []);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(100);

  const total = items.reduce((s, h) => s + h.quantity * h.lastPriceChf, 0);
  const cost = items.reduce((s, h) => s + h.quantity * h.costBasisChf, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
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
        {(total - cost).toLocaleString("de-CH")})
      </p>
      <ul className="text-sm space-y-1">
        {items.map((h) => (
          <li key={h.id} className="flex justify-between border border-border rounded px-2 py-1">
            <span>
              {h.symbol} · {h.quantity} × {h.lastPriceChf} CHF
            </span>
            <button type="button" className="text-[10px] underline" onClick={() => void remove(h.id)}>
              {t("delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
