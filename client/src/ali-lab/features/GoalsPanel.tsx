import { useEffect, useRef, useState } from "react";
import { Plus, Shield, Car, Mountain, Home, CheckCircle2, MoreVertical, Sparkles, Pencil, Trash2 } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabGoal } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

export function GoalsPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabFeatureText(feature);
  const { month } = usePersonalPlan();
  const { items, add, update, remove } = useAliLabPersist<LabGoal>(labCollections.goals, "goals", []);
  const ledger = usePersonalBudgetLedger(month);
  const monthSurplus = Math.max(0, ledger.householdMonth.savings);
  const [allocatedFromSurplus, setAllocatedFromSurplus] = useState(0);
  const surplus = Math.max(0, monthSurplus - allocatedFromSurplus);
  const formRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [menuGoalId, setMenuGoalId] = useState<string | null>(null);
  const [formHighlight, setFormHighlight] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [contributeDrafts, setContributeDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setAllocatedFromSurplus(0);
  }, [month]);

  const [name, setName] = useState("");
  const [targetInput, setTargetInput] = useState("5000");
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

  const contributeCustom = (goal: LabGoal) => {
    const raw = contributeDrafts[goal.id] ?? "";
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError(t("goalNeedContribute"));
      return;
    }
    setFormError(null);
    const next = Math.min(goal.targetChf, Math.max(0, goal.currentChf + amount));
    void update(goal.id, { currentChf: next });
    setContributeDrafts((prev) => ({ ...prev, [goal.id]: "" }));
  };

  const editGoal = (goal: LabGoal) => {
    setMenuGoalId(null);
    const nextName = prompt(t("goalName"), goal.name);
    if (nextName == null || !nextName.trim()) return;
    const nextTarget = prompt(t("target"), String(goal.targetChf));
    if (nextTarget == null) return;
    const parsed = Number(nextTarget);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    void update(goal.id, { name: nextName.trim(), targetChf: parsed });
  };

  const deleteGoal = (goal: LabGoal) => {
    setMenuGoalId(null);
    if (!confirm(t("goalDeleteConfirm").replace("{name}", goal.name))) return;
    void remove(goal.id);
  };

  const focusNewGoalForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFormHighlight(true);
    setFormError(null);
    window.setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 280);
    window.setTimeout(() => setFormHighlight(false), 2200);
  };

  const submitGoal = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError(t("goalNeedName"));
      focusNewGoalForm();
      return;
    }
    const targetChf = Number(targetInput.replace(",", "."));
    if (!Number.isFinite(targetChf) || targetChf <= 0) {
      setFormError(t("goalNeedTarget"));
      return;
    }
    void add({
      name: name.trim(),
      targetChf,
      currentChf: 0,
      type,
      deadline: deadline || undefined,
    });
    setName("");
    setDeadline("");
    setTargetInput("5000");
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-[var(--pp-primary)] text-xs font-semibold uppercase tracking-[0.2em]">
            {t("goalsEyebrow")}
          </span>
          <h2 className="text-2xl md:text-4xl font-bold mt-2">{t("goalsTitle")}</h2>
          <p className="text-[var(--pp-on-surface-variant)] text-sm mt-2 max-w-xl">{t("goalsIntro")}</p>
        </div>
        <GlassCard className="px-4 py-2 text-xs text-[var(--pp-on-surface-variant)]">
          {t("goalsSurplusLabel")} ({month}):{" "}
          <strong className="text-[var(--pp-secondary)]">{formatChfDisplay(surplus)}</strong>
        </GlassCard>
      </section>

      <GlassCard
        className={`p-4 transition-shadow ${formHighlight ? "ring-2 ring-[var(--pp-primary)] shadow-lg" : ""}`}
        id="goal-form"
      >
        <div ref={formRef}>
          <p className="text-xs font-semibold text-[var(--pp-primary)] uppercase tracking-wide mb-2">
            {t("goalFormLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={nameRef}
              className="pp-input px-3 py-2 flex-1 min-w-[140px] text-sm"
              placeholder={t("goalName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitGoal();
              }}
            />
            <input
              type="text"
              inputMode="decimal"
              className="pp-input px-3 py-2 w-28 text-sm pp-tabular"
              placeholder={t("target")}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              aria-label={t("target")}
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
              <option value="savings">{t("goalTypeSavings")}</option>
              <option value="debt">{t("goalTypeDebt")}</option>
            </select>
            <button
              type="button"
              className="flex items-center gap-2 bg-[var(--pp-primary)] text-[var(--pp-on-primary)] px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90"
              onClick={submitGoal}
            >
              <Plus className="size-4" />
              {t("addGoal")}
            </button>
          </div>
          {formError && <p className="text-xs text-[var(--pp-error)] mt-2">{formError}</p>}
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
          const menuOpen = menuGoalId === g.id;

          return (
            <GlassCard key={g.id} className="p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-[var(--pp-surface-highest)] rounded-lg">
                  <Icon className="size-5 text-[var(--pp-primary)]" />
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] p-1"
                    onClick={() => setMenuGoalId(menuOpen ? null : g.id)}
                    aria-label={t("goalOptions")}
                  >
                    <MoreVertical className="size-4" />
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 top-7 z-10 min-w-[140px] pp-glass-panel rounded-lg py-1 text-xs shadow-lg">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--pp-surface-highest)] text-left"
                        onClick={() => editGoal(g)}
                      >
                        <Pencil className="size-3.5" />
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--pp-surface-highest)] text-left text-[var(--pp-error)]"
                        onClick={() => deleteGoal(g)}
                      >
                        <Trash2 className="size-3.5" />
                        {t("delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                <p className="text-[11px] text-[var(--pp-on-surface-variant)] uppercase">
                  {g.type === "debt" ? t("goalTypeDebt") : t("goalTypeSavings")}
                </p>
              </div>
              {complete ? (
                <div className="flex items-center gap-2 text-[var(--pp-secondary)] font-bold text-sm py-4">
                  <CheckCircle2 className="size-4" />
                  {t("goalAchieved")}
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
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)]">{t("goalCurrent")}</p>
                  <p className="font-semibold text-[var(--pp-primary)]">{formatChfDisplay(g.currentChf)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)]">{t("goalTargetLabel")}</p>
                  <p className="font-semibold">{formatChfDisplay(g.targetChf)}</p>
                </div>
              </div>
              {g.deadline && (
                <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
                  {daysLeft != null && daysLeft >= 0
                    ? t("goalDaysLeft").replace("{n}", String(daysLeft))
                    : t("overdue")}{" "}
                  · {g.deadline}
                </p>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  className="pp-input px-2 py-1 w-24 text-[11px] pp-tabular"
                  placeholder={t("goalContributePh")}
                  value={contributeDrafts[g.id] ?? ""}
                  onChange={(e) =>
                    setContributeDrafts((prev) => ({ ...prev, [g.id]: e.target.value }))
                  }
                  disabled={complete}
                />
                <button
                  type="button"
                  className="text-[11px] font-bold text-[var(--pp-on-surface)] px-2 py-1 rounded bg-[var(--pp-surface-highest)] disabled:opacity-40"
                  disabled={complete}
                  onClick={() => contributeCustom(g)}
                >
                  {t("goalContribute")}
                </button>
                <button
                  type="button"
                  className="text-[11px] underline text-[var(--pp-on-surface-variant)] disabled:opacity-40"
                  disabled={complete}
                  onClick={() => void update(g.id, { currentChf: Math.min(g.targetChf, g.currentChf + 500) })}
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
              </div>
            </GlassCard>
          );
        })}

        <button type="button" onClick={focusNewGoalForm} className="text-left w-full">
          <GlassCard className="p-5 border-dashed border-2 border-[var(--pp-outline-variant)] bg-transparent flex flex-col items-center justify-center gap-3 min-h-[280px] opacity-80 hover:opacity-100 hover:border-[var(--pp-primary)]/40 transition-all cursor-pointer">
            <div className="w-14 h-14 rounded-full border border-[var(--pp-outline-variant)] flex items-center justify-center">
              <Plus className="size-6 text-[var(--pp-on-surface-variant)]" />
            </div>
            <p className="text-sm font-semibold">{t("newGoal")}</p>
            <p className="text-[11px] text-[var(--pp-on-surface-variant)] text-center px-4">{t("newGoalHint")}</p>
          </GlassCard>
        </button>

        <GlassCard className="p-5 bg-gradient-to-br from-[var(--pp-surface-low)] to-[var(--pp-surface)] border-[var(--pp-primary)]/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-[var(--pp-primary)]" />
              <h4 className="text-xs font-semibold text-[var(--pp-primary)] uppercase">{t("goalsInsightTitle")}</h4>
            </div>
            <p className="text-sm font-semibold leading-snug mb-2">
              {items.length > 0
                ? t("goalsInsightProgress")
                    .replace("{done}", String(items.filter((g) => g.currentChf >= g.targetChf).length))
                    .replace("{total}", String(items.length))
                : t("goalsInsightEmpty")}
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
