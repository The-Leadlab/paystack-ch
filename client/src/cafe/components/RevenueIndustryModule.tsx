import React, { useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SectorId } from '../lib/revenueSectors';
import { computeSectorModule, getSectorMeta, setSectorKeywords } from '../lib/revenueSectors';
import type { IncomeRow } from '../lib/revenueAnalytics';

const CHART_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8'];

type Props = {
  sector: SectorId;
  rows: IncomeRow[];
  fmt: (n: number) => string;
  fmtChf: (n: number) => string;
  t: (key: string) => string;
  onRecipeSaved?: () => void;
};

export function RevenueIndustryModule({ sector, rows, fmt, fmtChf, t, onRecipeSaved }: Props) {
  const meta = getSectorMeta(sector);
  const data = computeSectorModule(sector, rows, fmt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meta.keywords.join(', '));

  const openEdit = () => {
    setDraft(getSectorMeta(sector).keywords.join(', '));
    setEditing(true);
  };

  const saveEdit = () => {
    const keywords = draft
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    setSectorKeywords(sector, keywords);
    setEditing(false);
    onRecipeSaved?.();
  };

  return (
    <section className="ba-industry-module">
      <header className="ba-industry-module__head">
        <div>
          <p className="ba-industry-module__eyebrow">
            {t('rhIndustryModule')} {meta.icon} {t(meta.titleKey)}
          </p>
          <p className="ba-industry-module__desc">{t(meta.descKey)}</p>
        </div>
        <button type="button" className="ba-revenue-link-btn" onClick={openEdit}>
          {t('rhEditRecipe')}
        </button>
      </header>

      {editing ? (
        <div className="ba-industry-module__recipe">
          <label className="ba-industry-module__recipe-label" htmlFor={`recipe-${sector}`}>
            {t('rhEditRecipeHint')}
          </label>
          <textarea
            id={`recipe-${sector}`}
            className="ba-industry-module__recipe-input"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="ba-revenue-cta" onClick={saveEdit}>
              {t('rhSaveRecipe')}
            </button>
            <button type="button" className="ba-revenue-link-btn" onClick={() => setEditing(false)}>
              {t('rhCancelRecipe')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="ba-kpi-grid-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.labelKey} className="ba-sector-kpi">
            <p className="ba-sector-kpi__label">{t(kpi.labelKey)}</p>
            <p className="ba-sector-kpi__value">{kpi.value}</p>
            {kpi.sub ? <p className="ba-sector-kpi__sub">{kpi.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <ChartPanel title={t(data.leftTitleKey)} bars={data.leftBars} fmtChf={fmtChf} empty={t('rhNoTaggedTx')} />
        <ChartPanel title={t(data.rightTitleKey)} bars={data.rightBars} fmtChf={fmtChf} empty={t('rhNoTaggedTx')} />
      </div>
    </section>
  );
}

function ChartPanel({
  title,
  bars,
  fmtChf,
  empty,
}: {
  title: string;
  bars: { name: string; amount: number }[];
  fmtChf: (n: number) => string;
  empty: string;
}) {
  const max = Math.max(...bars.map((b) => b.amount), 1);

  return (
    <div className="ba-panel ba-industry-chart">
      <p className="text-xs text-cdlp-muted uppercase tracking-wide mb-3">{title}</p>
      {bars.length === 0 ? (
        <p className="text-sm text-cdlp-muted py-8 text-center">{empty}</p>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {bars.map((b) => (
              <div key={b.name}>
                <div className="flex justify-between text-xs gap-2">
                  <span className="text-cdlp-muted truncate">{b.name}</span>
                  <span className="font-bold tabular-nums shrink-0">{fmtChf(b.amount)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-cdlp-border/40">
                  <div
                    className="h-full rounded-full bg-emerald-400/80"
                    style={{ width: `${(b.amount / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} layout="vertical" margin={{ left: 4, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={64}
                  tick={{ fontSize: 10, fill: '#9aa0a6' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#2d3238',
                    border: '1px solid #3d4450',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [fmtChf(value), '']}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {bars.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
