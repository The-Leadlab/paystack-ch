import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabHolding } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

export function InvestmentsPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const ledger = useAliLabLedger();
  const { items, add, remove, update } = useAliLabPersist<LabHolding>(labCollections.holdings, "holdings", []);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(100);
  const [query, setQuery] = useState("");

  const total = items.reduce((s, h) => s + h.quantity * h.lastPriceChf, 0);
  const cost = items.reduce((s, h) => s + h.quantity * h.costBasisChf, 0);
  const pl = total - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  const vsOperating = useMemo(() => {
    if (ledger.balance === 0) return null;
    return (total / Math.abs(ledger.balance)) * 100;
  }, [total, ledger.balance]);

  const filtered = items.filter(
    (h) =>
      !query.trim() ||
      h.symbol.toLowerCase().includes(query.toLowerCase()) ||
      h.name.toLowerCase().includes(query.toLowerCase())
  );

  const allocation = useMemo(() => {
    if (total <= 0) return [];
    return items.map((h) => ({
      ...h,
      mv: h.quantity * h.lastPriceChf,
      weight: (h.quantity * h.lastPriceChf) / total,
    }));
  }, [items, total]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--pp-on-surface-variant)]">{summary}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 h-32 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-[var(--pp-on-surface-variant)]">
            Total portfolio
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold pp-tabular">{formatChfDisplay(total)}</span>
            <span className={`text-xs font-bold ${pl >= 0 ? "text-[var(--pp-secondary)]" : "text-[var(--pp-error)]"}`}>
              {plPct >= 0 ? "+" : ""}
              {plPct.toFixed(1)}%
            </span>
          </div>
        </GlassCard>
        <GlassCard className="p-5 h-32 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-[var(--pp-on-surface-variant)]">Cost basis</span>
          <span className="text-xl font-semibold pp-tabular">{formatChfDisplay(cost)}</span>
        </GlassCard>
        <GlassCard className="p-5 h-32 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-[var(--pp-on-surface-variant)]">P/L</span>
          <span
            className={`text-xl font-semibold pp-tabular ${pl >= 0 ? "text-[var(--pp-secondary)]" : "text-[var(--pp-error)]"}`}
          >
            {formatChfDisplay(pl)}
          </span>
        </GlassCard>
      </div>

      {vsOperating != null && Number.isFinite(vsOperating) && (
        <p className="text-xs text-[var(--pp-on-surface-variant)]">
          Portfolio vs operating balance: <strong>{vsOperating.toFixed(1)}%</strong> of session net (
          {formatChfDisplay(ledger.balance)})
        </p>
      )}

      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="pp-input px-3 py-2 w-20 text-sm uppercase"
            placeholder="NESN"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
          <input
            className="pp-input px-3 py-2 flex-1 min-w-[120px] text-sm"
            placeholder="Nestlé"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            className="pp-input px-3 py-2 w-16 text-sm"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          <input
            type="number"
            className="pp-input px-3 py-2 w-24 text-sm"
            placeholder="Price CHF"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
          <button
            type="button"
            className="bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] px-4 py-2 rounded-lg text-xs font-bold"
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
            Add holding
          </button>
        </div>
      </GlassCard>

      {allocation.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-base font-semibold mb-4">Asset allocation</h3>
          <div className="h-48 grid grid-cols-6 grid-rows-4 gap-1">
            {allocation.slice(0, 4).map((h, i) => {
              const colSpan = i === 0 ? 3 : i === 1 ? 3 : 2;
              const rowSpan = i === 0 ? 4 : 2;
              return (
                <div
                  key={h.id}
                  className={`col-span-${colSpan} row-span-${rowSpan} border border-[var(--pp-primary)]/30 bg-[var(--pp-primary-container)]/20 p-2 rounded flex flex-col justify-between`}
                  style={{
                    gridColumn: `span ${colSpan}`,
                    gridRow: `span ${rowSpan}`,
                  }}
                >
                  <span className="text-xs font-bold text-[var(--pp-primary)]">{h.symbol}</span>
                  <div className="text-right text-sm pp-tabular">
                    <div>{Math.round(h.weight * 100)}%</div>
                    <div className="text-[10px] opacity-70">{formatChfDisplay(h.mv)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5 overflow-hidden">
        <div className="flex justify-between items-center mb-4 gap-3">
          <h3 className="text-base font-semibold">Holdings</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--pp-on-surface-variant)]" />
            <input
              className="pp-input pl-10 pr-3 py-2 text-sm w-48"
              placeholder="Search assets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--pp-outline-variant)] text-[11px] uppercase text-[var(--pp-on-surface-variant)]">
                <th className="pb-3 px-2">Asset</th>
                <th className="pb-3 px-2 text-right">Value</th>
                <th className="pb-3 px-2 text-right">Weight</th>
                <th className="pb-3 px-2 text-right">P/L</th>
                <th className="pb-3 px-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const mv = h.quantity * h.lastPriceChf;
                const weight = total > 0 ? (mv / total) * 100 : 0;
                const rowPl = mv - h.quantity * h.costBasisChf;
                return (
                  <tr
                    key={h.id}
                    className="border-b border-[var(--pp-border)]/50 hover:bg-[var(--pp-surface-high)] transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div className="font-bold">{h.symbol}</div>
                      <div className="text-[11px] text-[var(--pp-on-surface-variant)]">
                        {h.name} · {h.quantity} × {formatChfDisplay(h.lastPriceChf, { prefix: false })}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right pp-tabular font-mono">{formatChfDisplay(mv)}</td>
                    <td className="py-3 px-2 text-right pp-tabular">{weight.toFixed(0)}%</td>
                    <td
                      className={`py-3 px-2 text-right pp-tabular ${rowPl >= 0 ? "text-[var(--pp-secondary)]" : "text-[var(--pp-error)]"}`}
                    >
                      {formatChfDisplay(rowPl)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        type="button"
                        className="text-[10px] underline text-[var(--pp-on-surface-variant)] mr-2"
                        onClick={() => {
                          const next = prompt("New price CHF", String(h.lastPriceChf));
                          if (next != null) void update(h.id, { lastPriceChf: Number(next) || h.lastPriceChf });
                        }}
                      >
                        {t("updatePrice")}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] underline text-[var(--pp-error)]"
                        onClick={() => void remove(h.id)}
                      >
                        {t("delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
