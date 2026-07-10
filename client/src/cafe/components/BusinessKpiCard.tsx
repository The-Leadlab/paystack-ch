import type { LucideIcon } from 'lucide-react';

type Tone = 'green' | 'red' | 'gold' | 'neutral' | 'blue' | 'purple';

const toneColors: Record<Tone, { value: string; bar: string }> = {
  green: { value: 'text-emerald-400', bar: 'bg-emerald-400' },
  red: { value: 'text-red-400', bar: 'bg-red-400' },
  gold: { value: 'text-zinc-300', bar: 'bg-zinc-500' },
  neutral: { value: 'text-zinc-300', bar: 'bg-zinc-500' },
  blue: { value: 'text-blue-400', bar: 'bg-blue-400' },
  purple: { value: 'text-violet-400', bar: 'bg-violet-500' },
};

export function BusinessKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  progressPct,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: Tone;
  progressPct: number;
}) {
  const colors = toneColors[tone];
  const pct = Math.min(100, Math.max(0, progressPct));

  return (
    <div className="ba-kpi-card">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${colors.value}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-cdlp-muted">{label}</span>
      </div>
      <p className={`text-2xl md:text-[1.75rem] font-extrabold tabular-nums tracking-tight ${colors.value}`}>
        {value}
      </p>
      {hint ? <p className="text-[10px] text-cdlp-muted leading-snug">{hint}</p> : null}
      <div className="ba-kpi-track">
        <div className={`ba-kpi-fill ${colors.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
