import type { LucideIcon } from 'lucide-react';

type Tone = 'green' | 'red' | 'gold' | 'neutral' | 'blue' | 'purple';

const toneColors: Record<Tone, { icon: string; bar: string }> = {
  green: { icon: 'text-emerald-400', bar: 'bg-emerald-400' },
  red: { icon: 'text-red-400', bar: 'bg-red-400' },
  gold: { icon: 'text-zinc-400', bar: 'bg-zinc-400' },
  neutral: { icon: 'text-zinc-400', bar: 'bg-zinc-500' },
  blue: { icon: 'text-blue-400', bar: 'bg-blue-400' },
  purple: { icon: 'text-violet-400', bar: 'bg-violet-400' },
};

export function BusinessKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  progressPct,
  suffix = ' CHF',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: Tone;
  progressPct: number;
  suffix?: string;
}) {
  const colors = toneColors[tone];
  const pct = Math.min(100, Math.max(0, progressPct));

  return (
    <div className="ba-kpi-card">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${colors.icon}`} aria-hidden />
        <span className="ba-kpi-label">{label}</span>
      </div>
      <p className="ba-kpi-value">
        {value}
        {suffix}
      </p>
      {hint ? <p className="ba-kpi-hint">{hint}</p> : null}
      <div className="ba-kpi-track">
        <div className={`ba-kpi-fill ${colors.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
