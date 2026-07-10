import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Home,
  ShoppingCart,
  Receipt,
  Sparkles,
  Banknote,
  TrendingUp,
  Gift,
} from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import type { LabBudgetMode } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  classifyPersonalExpense,
  classifyPersonalIncome,
  personalExpenseLabelKey,
  personalIncomeLabelKey,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../personalCategories";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { PersonalRecentLedger } from "../personal-plan/components/PersonalRecentLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

type BudgetRow = {
  id: string;
  month: string;
  category: string;
  budgetChf: number;
  mode: LabBudgetMode;
};

const EXPENSE_ICONS: Record<PersonalExpenseCategory, typeof Home> = {
  BILLS: Receipt,
  RENT: Home,
  GROCERIES: ShoppingCart,
  GOING_OUT: Sparkles,
  SHOPPING_OTHER: ShoppingCart,
  SAVINGS_INVEST: TrendingUp,
};

const INCOME_ICONS: Record<PersonalIncomeCategory, typeof Banknote> = {
  SALARY: Banknote,
  ASSET_REVENUE: TrendingUp,
  CONTRIBUTIONS: Gift,
};

function ExpenseRow({
  label,
  budgetInput,
  spent,
  onBudgetInputChange,
  onBudgetCommit,
  Icon,
}: {
  label: string;
  budgetInput: string;
  spent: number;
  onBudgetInputChange: (v: string) => void;
  onBudgetCommit: () => void;
  Icon: typeof Home;
}) {
  const budget = Number(budgetInput) || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : spent > 0 ? 100 : 0;
  const over = budget > 0 && spent > budget;
  const barWidth = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className={`size-4 shrink-0 ${over ? "text-[var(--pp-error)]" : "text-[var(--pp-primary)]"}`}
            style={over ? { fill: "currentColor", opacity: 0.3 } : undefined}
          />
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <div className="text-right shrink-0 text-sm pp-tabular">
          <span className={over ? "text-[var(--pp-error)] font-bold" : "font-semibold"}>
            {formatChfDisplay(spent, { prefix: false })}
          </span>
          <span className="text-[var(--pp-on-surface-variant)] mx-1">/</span>
          <input
            type="text"
            inputMode="decimal"
            className="pp-input w-20 text-right text-xs py-0.5 px-1 inline-block"
            value={budgetInput}
            onChange={(e) => onBudgetInputChange(e.target.value)}
            onBlur={onBudgetCommit}
            aria-label={`Budget for ${label}`}
          />
        </div>
      </div>
      <div className="pp-progress-track h-1">
        <div
          className={`h-full transition-all duration-500 ${over ? "bg-[var(--pp-error)]" : "bg-[var(--pp-primary)]"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {over && (
        <p className="text-[11px] text-[var(--pp-error)]">
          {formatChfDisplay(spent - budget)} over budget
        </p>
      )}
    </div>
  );
}

export function BudgetingPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabFeatureText(feature);
  const { month } = usePersonalPlan();
  const ledger = useAliLabLedger(month);
  const { loading: finLoading, currentSession } = ledger;
  const [mode, setMode] = useState<LabBudgetMode>("traditional");
  const [draftBudgets, setDraftBudgets] = useState<Record<string, string>>({});

  const { items: saved, update, add, uid } = useAliLabPersist<BudgetRow>(
    labCollections.budgets,
    "budgets",
    []
  );

  useEffect(() => {
    const modeRow = saved.find((b) => b.month === month && b.category === "__mode__");
    if (modeRow?.mode) setMode(modeRow.mode);
    else {
      const row = saved.find((b) => b.month === month && b.mode);
      if (row?.mode) setMode(row.mode);
    }
  }, [saved, month]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const cat of PERSONAL_EXPENSE_CATEGORIES) {
      const row = saved.find((b) => b.month === month && b.category === cat);
      next[cat] = row && row.budgetChf > 0 ? String(row.budgetChf) : "";
    }
    for (const cat of PERSONAL_INCOME_CATEGORIES) {
      const key = `income:${cat}`;
      const row = saved.find((b) => b.month === month && b.category === key);
      next[key] = row && row.budgetChf > 0 ? String(row.budgetChf) : "";
    }
    setDraftBudgets(next);
  }, [saved, month]);

  const persistMode = async (next: LabBudgetMode) => {
    setMode(next);
    const marker = saved.find((b) => b.month === month && b.category === "__mode__");
    const payload = { month, category: "__mode__", budgetChf: 0, mode: next };
    if (marker) await update(marker.id, payload);
    else await add(payload);
  };

  const inSession = (sessionId: string) =>
    ledger.isAllSessionsView || !currentSession?.id || sessionId === currentSession.id;

  const expenseRows = useMemo(() => {
    return PERSONAL_EXPENSE_CATEGORIES.map((cat) => {
      const savedRow = saved.find((b) => b.month === month && b.category === cat);
      const budgetChf = savedRow?.budgetChf ?? 0;
      const spent = ledger.monthExpenses
        .filter((e) => inSession(e.session_id) && classifyPersonalExpense(e) === cat)
        .reduce((s, e) => s + e.amount, 0);
      return { cat, budgetChf, spent, id: savedRow?.id };
    });
  }, [saved, month, ledger.monthExpenses, currentSession?.id, ledger.isAllSessionsView]);

  const incomeRows = useMemo(() => {
    return PERSONAL_INCOME_CATEGORIES.map((cat) => {
      const key = `income:${cat}`;
      const savedRow = saved.find((b) => b.month === month && b.category === key);
      const budgetChf = savedRow?.budgetChf ?? 0;
      const received = ledger.monthIncome
        .filter((i) => inSession(i.session_id) && classifyPersonalIncome(i) === cat)
        .reduce((s, i) => s + i.amount, 0);
      return { cat, key, budgetChf, received, id: savedRow?.id };
    });
  }, [saved, month, ledger.monthIncome, currentSession?.id, ledger.isAllSessionsView]);

  const totalExpenseBudget = expenseRows.reduce((s, r) => s + r.budgetChf, 0);
  const totalSpent = expenseRows.reduce((s, r) => s + r.spent, 0);
  const totalIncomeExpected = incomeRows.reduce((s, r) => s + r.budgetChf, 0);
  const totalIncomeReceived = incomeRows.reduce((s, r) => s + r.received, 0);
  const zeroBasedGap = mode === "zero-based" ? totalIncomeReceived - totalExpenseBudget : 0;
  const allocatedPct =
    totalIncomeReceived > 0
      ? Math.min(100, Math.round((totalExpenseBudget / totalIncomeReceived) * 100))
      : 0;
  const dashOffset = 282.7 - (282.7 * allocatedPct) / 100;

  const setBudget = async (category: string, budgetChf: number) => {
    const existing = saved.find((b) => b.month === month && b.category === category);
    const payload = { month, category, budgetChf, mode };
    if (existing) await update(existing.id, payload);
    else await add(payload);
  };

  const commitBudgetDraft = (category: string) => {
    const raw = draftBudgets[category] ?? "";
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    void setBudget(category, parsed);
  };

  const displayBudget = (category: string, fallback: number) =>
    draftBudgets[category] ?? (fallback > 0 ? String(fallback) : "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center text-xs">
        <select
          className="pp-input rounded px-2 py-1"
          value={mode}
          onChange={(e) => void persistMode(e.target.value as LabBudgetMode)}
        >
          <option value="traditional">{t("traditional")}</option>
          <option value="zero-based">{t("zeroBased")}</option>
        </select>
        {finLoading && <span className="text-[var(--pp-on-surface-variant)]">{t("loadingLedger")}</span>}
        {!uid && <span className="text-[var(--pp-primary)]">{t("localBudgetCache")}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <GlassCard className="p-5 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{t("incomeExpected")}</h2>
            </div>
            <div className="space-y-3">
              {incomeRows.map((row) => {
                const Icon = INCOME_ICONS[row.cat];
                const pct =
                  row.budgetChf > 0 ? Math.min(100, Math.round((row.received / row.budgetChf) * 100)) : 0;
                return (
                  <div
                    key={row.key}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--pp-surface-highest)] transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[var(--pp-secondary)]/10 flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-[var(--pp-secondary)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t(personalIncomeLabelKey(row.cat))}</p>
                        <p className="text-[11px] text-[var(--pp-on-surface-variant)]">{t("expected")}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold pp-tabular">{formatChfDisplay(row.received)}</p>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="pp-input w-24 text-right text-xs py-0.5 px-1 mt-1"
                        value={displayBudget(row.key, row.budgetChf)}
                        onChange={(e) =>
                          setDraftBudgets((prev) => ({ ...prev, [row.key]: e.target.value }))
                        }
                        onBlur={() => commitBudgetDraft(row.key)}
                        aria-label={t(personalIncomeLabelKey(row.cat))}
                      />
                      <div className="pp-progress-track h-1 w-24 ml-auto mt-1">
                        <div className="h-full bg-[var(--pp-secondary)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--pp-border)] flex justify-between text-sm font-bold pp-tabular">
              <span>{t("total")}</span>
              <span>
                {formatChfDisplay(totalIncomeReceived)} / {formatChfDisplay(totalIncomeExpected, { prefix: false })}
              </span>
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{t("expensesHousehold")}</h2>
              <div className="flex gap-1">
                <span className="bg-[var(--pp-surface-highest)] px-2 py-0.5 rounded-full text-[11px]">
                  {t("spent")}
                </span>
                <span className="bg-[var(--pp-primary)]/10 text-[var(--pp-primary)] px-2 py-0.5 rounded-full text-[11px]">
                  {t("budget")}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {expenseRows.map((row) => (
                <ExpenseRow
                  key={row.cat}
                  label={t(personalExpenseLabelKey(row.cat))}
                  budgetInput={displayBudget(row.cat, row.budgetChf)}
                  spent={row.spent}
                  onBudgetInputChange={(v) =>
                    setDraftBudgets((prev) => ({ ...prev, [row.cat]: v }))
                  }
                  onBudgetCommit={() => commitBudgetDraft(row.cat)}
                  Icon={EXPENSE_ICONS[row.cat]}
                />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--pp-border)] flex justify-between text-sm font-bold pp-tabular">
              <span>{t("total")}</span>
              <span>
                {formatChfDisplay(totalSpent)} / {formatChfDisplay(totalExpenseBudget, { prefix: false })}
              </span>
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <GlassCard className="p-5 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Budget mode</h2>
              <button
                type="button"
                onClick={() => void persistMode(mode === "zero-based" ? "traditional" : "zero-based")}
                className="w-12 h-6 bg-[var(--pp-surface-highest)] rounded-full relative p-0.5"
                aria-pressed={mode === "zero-based"}
              >
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-lg transition-all ${
                    mode === "zero-based"
                      ? "right-1 bg-[var(--pp-primary)]"
                      : "left-1 bg-[var(--pp-on-surface-variant)]"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[var(--pp-primary)]/10 rounded-lg">
                <ArrowLeftRight className="size-5 text-[var(--pp-primary)]" />
              </div>
              <div>
                <p className="text-sm font-bold">{mode === "zero-based" ? t("zeroBased") : t("traditional")}</p>
                <p className="text-[11px] text-[var(--pp-on-surface-variant)]">Every CHF has a job</p>
              </div>
            </div>
            {mode === "zero-based" && (
              <>
                <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="transparent" r="45" stroke="#333333" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="45"
                      stroke="#ffb3ad"
                      strokeDasharray="282.7"
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold pp-tabular">{allocatedPct}%</span>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--pp-on-surface-variant)]">
                      Allocated
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--pp-on-surface-variant)]">{t("unallocated")}</span>
                    <span className={zeroBasedGap < 0 ? "text-[var(--pp-error)]" : "text-[var(--pp-primary)]"}>
                      {formatChfDisplay(Math.abs(zeroBasedGap))}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
                    {t("incomeThisMonth")}: {formatChfDisplay(totalIncomeReceived)}
                  </p>
                </div>
              </>
            )}
          </GlassCard>

          <GlassCard className="p-5 bg-gradient-to-br from-[var(--pp-primary-container)]/20 to-[var(--pp-primary)]/5 border-[var(--pp-primary)]/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[var(--pp-primary-container)] rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="size-5 text-[var(--pp-on-primary)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--pp-primary)]">Wealth booster</h3>
                <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1">
                  {ledger.householdMonth.savingsRatePct >= 0
                    ? `Savings rate ${ledger.householdMonth.savingsRatePct}% for ${month}.`
                    : "Review expenses to improve your savings rate this month."}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <PersonalRecentLedger month={month} />
    </div>
  );
}
