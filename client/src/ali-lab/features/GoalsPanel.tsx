import { useEffect, useState } from "react";
import { Plus, Shield, Car, Mountain, Home, CheckCircle2, MoreVertical, Sparkles } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabGoal } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

export function GoalsPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabFeatureText(feature);
  const { month } = usePersonalPlan();
  const { items, add, update, remove } = useAliLabPersist<LabGoal>(labCollections.goals, "goals", []);
  const ledger = useAliLabLedger(month);
  const monthSurplus = Math.max(0, ledger.householdMonth.savings);
  const [allocatedFromSurplus, setAllocatedFromSurplus] = useState(0);
  const surplus = Math.max(0, monthSurplus - allocatedFromSurplus);

  useEffect(() => {
    setAllocatedFromSurplus(0);
  }, [month]);

  const [name, setName] = useState("");
  const [targetChf, setTargetChf] = useState(5000);
  const [type, setType] = useState<LabGoal["type"]>("savings");
  const [deadline, setDeadline] = useState("");

  const applySurplus = (goal: LabGoal) => {
    if (surplus <= 0) return;
    const room = Math.max(0, goal.targetChf - goal.currentChf);
    const addAmount = Math.min(surplus, room);
    if (addAmount > 0) {
      void update(goal.id, { currentChf: goal.currentChf + addAmount });
      setAllocatedFromSurplus((prev) => prev + addAmount);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-[var(--pp-primary)] text-xs font-semibold uppercase tracking-[0.2em]">
            Growth strategy
          </span>
          <h2 className="text-2xl md:text-4xl font-bold mt-2">Financial goals</h2>
          <p className="text-[var(--pp-on-surface-variant)] text-sm mt-2 max-w-xl">
            Track savings and debt payoff with live ledger surplus.
          </p>
        </div>
        <GlassCard className="px-4 py-2 text-xs text-[var(--pp-on-surface-variant)]">
          Available surplus ({month}):{" "}
          <strong className="text-[var(--pp-secondary)]">{formatChfDisplay(surplus)}</strong>
        </GlassCard>
      </section>

      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="pp-input px-3 py-2 flex-1 min-w-[140px] text-sm"
            placeholder={t("goalName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            className="pp-input px-3 py-2 w-28 text-sm"
            value={targetChf}
            onChange={(e) => setTargetChf(Number(e.target.value))}
          />
          <input
            type="date"
            className="pp-input px-3 py-2 text-sm"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <select
            className="pp-input px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as LabGoal["type"])}
          >
            <option value="savings">Savings</option>
            <option value="debt">Debt payoff</option>
          </select>
          <button
            type="button"
            className="flex items-center gap-2 bg-[var(--pp-primary)] text-[var(--pp-on-primary)] px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90"
            onClick={() => {
              if (!name.trim()) return;
              void add({
                name: name.trim(),
                targetChf,
                currentChf: 0,
                type,
                deadline: deadline || undefined,
              });
              setName("");
              setDeadline("");
            }}
          >
            <Plus className="size-4" />
            {t("addGoal")}
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((g, idx) => {
          const pct = g.targetChf > 0 ? Math.min(100, Math.round((g.currentChf / g.targetChf) * 100)) : 0;
          const complete = pct >= 100;
          const daysLeft = g.deadline
            ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)
            : null;
          const icons = [Car, Mountain, Shield, Home];
          const Icon = icons[idx % icons.length];

          return (
            <GlassCard key={g.id} className="p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-[var(--pp-surface-highest)] rounded-lg">
                  <Icon className="size-5 text-[var(--pp-primary)]" />
                </div>
                <button type="button" className="text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)]">
                  <MoreVertical className="size-4" />
                </button>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                <p className="text-[11px] text-[var(--pp-on-surface-variant)] uppercase">{g.type}</p>
              </div>
              {complete ? (
                <div className="flex items-center gap-2 text-[var(--pp-secondary)] font-bold text-sm py-4">
                  <CheckCircle2 className="size-4" />
                  Goal achieved
                </div>
              ) : (
                <div className="flex items-center justify-center py-2">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle
                        className="stroke-[var(--pp-surface-highest)]"
                        cx="18"
                        cy="18"
                        fill="none"
                        r="16"
                        strokeWidth="3"
                      />
                      <circle
                        className="stroke-[var(--pp-primary)]"
                        cx="18"
                        cy="18"
                        fill="none"
                        r="16"
                        strokeDasharray={`${pct}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold">{pct}%</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--pp-border)] pt-3 text-sm pp-tabular">
                <div>
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)]">Current</p>
                  <p className="font-semibold text-[var(--pp-primary)]">{formatChfDisplay(g.currentChf)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)]">Target</p>
                  <p className="font-semibold">{formatChfDisplay(g.targetChf)}</p>
                </div>
              </div>
              {g.deadline && (
                <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
                  {daysLeft != null && daysLeft >= 0 ? `${daysLeft} days left` : "Overdue"} · {g.deadline}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-[11px] underline text-[var(--pp-on-surface-variant)]"
                  onClick={() => void update(g.id, { currentChf: g.currentChf + 500 })}
                >
                  +500 CHF
                </button>
                <button
                  type="button"
                  className="text-[11px] underline text-[var(--pp-primary)] font-bold disabled:opacity-40"
                  disabled={surplus <= 0 || g.currentChf >= g.targetChf}
                  onClick={() => applySurplus(g)}
                >
                  {t("fundFromSurplus")}
                </button>
                <button
                  type="button"
                  className="text-[11px] underline text-[var(--pp-error)]"
                  onClick={() => void remove(g.id)}
                >
                  {t("delete")}
                </button>
              </div>
            </GlassCard>
          );
        })}

        <GlassCard className="p-5 border-dashed border-2 border-[var(--pp-outline-variant)] bg-transparent flex flex-col items-center justify-center gap-3 min-h-[280px] opacity-80 hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full border border-[var(--pp-outline-variant)] flex items-center justify-center">
            <Plus className="size-6 text-[var(--pp-on-surface-variant)]" />
          </div>
          <p className="text-sm font-semibold">New goal</p>
        </GlassCard>

        <GlassCard className="p-5 bg-gradient-to-br from-[var(--pp-surface-low)] to-[var(--pp-surface)] border-[var(--pp-primary)]/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-[var(--pp-primary)]" />
              <h4 className="text-xs font-semibold text-[var(--pp-primary)] uppercase">Wealth insight</h4>
            </div>
            <p className="text-sm font-semibold leading-snug mb-2">
              {items.length > 0
                ? `${items.filter((g) => g.currentChf >= g.targetChf).length} of ${items.length} goals complete.`
                : "Add your first savings or debt goal."}
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
