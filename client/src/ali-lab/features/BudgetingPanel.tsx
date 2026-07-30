import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Home,
  ShoppingCart,
  Receipt,
  Sparkles,
  Banknote,
  TrendingUp,
  Gift,
  Wand2,
  CopyPlus,
} from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import type { LabBudgetMode } from "../types";
import { labCollections } from "../aliLabFirestore";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_EXPENSE_FIXED,
  PERSONAL_EXPENSE_SAVINGS,
  PERSONAL_EXPENSE_VARIABLE,
  PERSONAL_INCOME_CATEGORIES,
  personalExpenseLabelKey,
  personalIncomeLabelKey,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../personalCategories";
import { personalFeaturePath } from "../personal-plan/personalPlanNav";
import { Link } from "wouter";
import {
  shiftMonth,
  suggestExpenseBudgetsFromPersonal,
  suggestIncomeBudgetsFromPersonal,
} from "../utils/budgetSuggestions";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { PersonalRecentLedger } from "../personal-plan/components/PersonalRecentLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";
import { parseBudgetAmount } from "../lib/parseBudgetAmount";

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

const BUDGET_DEBOUNCE_MS = 400;

function ExpenseRow({
  label,
  budgetInput,
  spent,
  onBudgetInputChange,
  onBudgetCommit,
  Icon,
  href,
}: {
  label: string;
  budgetInput: string;
  spent: number;
  onBudgetInputChange: (v: string) => void;
  onBudgetCommit: () => void;
  Icon: typeof Home;
  href?: string;
}) {
  const budgetParsed = parseBudgetAmount(budgetInput);
  const budget = Number.isFinite(budgetParsed) ? budgetParsed : 0;
  const over = budget > 0 && spent > budget;
  const barWidth = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  const title = href ? (
    <Link href={href} className="text-sm font-medium truncate underline-offset-2 hover:underline text-[var(--pp-primary)]">
      {label}
    </Link>
  ) : (
    <span className="text-sm font-medium truncate">{label}</span>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className={`size-4 shrink-0 ${over ? "text-[var(--pp-error)]" : "text-[var(--pp-primary)]"}`}
            style={over ? { fill: "currentColor", opacity: 0.3 } : undefined}
          />
          {title}
        </div>
        <div className="text-right shrink-0 text-sm pp-tabular">
          <span className={over ? "text-[var(--pp-error)] font-bold" : "font-semibold"}>
            {formatChfDisplay(spent, { prefix: false })}
          </span>
          <span className="text-[var(--pp-on-surface-variant)] mx-1">/</span>
          <input
            type="text"
            inputMode="decimal"
            className="pp-input w-24 text-right text-xs py-0.5 px-1 inline-block"
            value={budgetInput}
            onChange={(e) => onBudgetInputChange(e.target.value)}
            onBlur={onBudgetCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
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
  const { month, surface } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);
  const { loading: finLoading } = ledger;
  const [mode, setMode] = useState<LabBudgetMode>("traditional");
  const [draftBudgets, setDraftBudgets] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const draftBudgetsRef = useRef(draftBudgets);
  draftBudgetsRef.current = draftBudgets;
  const billsHref = personalFeaturePath("bill-reminders", surface);

  const { items: saved, update, add, uid, syncError } = useAliLabPersist<BudgetRow>(
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
    setDirtyKeys({});
    for (const timer of Object.values(debounceTimers.current)) clearTimeout(timer);
    debounceTimers.current = {};
  }, [month]);

  useEffect(() => {
    setDraftBudgets((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const cat of PERSONAL_EXPENSE_CATEGORIES) {
        if (dirtyKeys[cat]) continue;
        const row = saved.find((b) => b.month === month && b.category === cat);
        next[cat] = row && row.budgetChf > 0 ? String(row.budgetChf) : "";
      }
      for (const cat of PERSONAL_INCOME_CATEGORIES) {
        const key = `income:${cat}`;
        if (dirtyKeys[key]) continue;
        const row = saved.find((b) => b.month === month && b.category === key);
        next[key] = row && row.budgetChf > 0 ? String(row.budgetChf) : "";
      }
      return next;
    });
  }, [saved, month, dirtyKeys]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(debounceTimers.current)) clearTimeout(timer);
    };
  }, []);

  const persistMode = async (next: LabBudgetMode) => {
    setMode(next);
    const marker = saved.find((b) => b.month === month && b.category === "__mode__");
    const payload = { month, category: "__mode__", budgetChf: 0, mode: next };
    if (marker) await update(marker.id, payload);
    else await add(payload);
  };

  const draftAmount = (category: string, fallback: number) => {
    if (category in draftBudgets) {
      const raw = draftBudgets[category] ?? "";
      if (raw.trim() === "") return 0;
      const parsed = parseBudgetAmount(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }
    return fallback;
  };

  const expenseRows = useMemo(() => {
    return PERSONAL_EXPENSE_CATEGORIES.map((cat) => {
      const savedRow = saved.find((b) => b.month === month && b.category === cat);
      const budgetChf = draftAmount(cat, savedRow?.budgetChf ?? 0);
      const spent = ledger.monthRows
        .filter((e) => e.kind === "expense" && e.expenseCat === cat)
        .reduce((s, e) => s + e.amount, 0);
      return { cat, budgetChf, spent, id: savedRow?.id };
    });
  }, [saved, month, ledger.monthRows, draftBudgets]);

  const incomeRows = useMemo(() => {
    return PERSONAL_INCOME_CATEGORIES.map((cat) => {
      const key = `income:${cat}`;
      const savedRow = saved.find((b) => b.month === month && b.category === key);
      const budgetChf = draftAmount(key, savedRow?.budgetChf ?? 0);
      const received = ledger.monthRows
        .filter((i) => i.kind === "income" && i.incomeCat === cat)
        .reduce((s, i) => s + i.amount, 0);
      return { cat, key, budgetChf, received, id: savedRow?.id };
    });
  }, [saved, month, ledger.monthRows, draftBudgets]);

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
    setDirtyKeys((prev) => {
      if (!prev[category]) return prev;
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const commitBudgetDraft = (category: string) => {
    const raw = draftBudgetsRef.current[category] ?? "";
    if (raw.trim() === "") {
      void setBudget(category, 0);
      return;
    }
    const parsed = parseBudgetAmount(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    void setBudget(category, parsed);
  };

  const scheduleCommit = (category: string) => {
    if (debounceTimers.current[category]) clearTimeout(debounceTimers.current[category]);
    debounceTimers.current[category] = setTimeout(() => {
      commitBudgetDraft(category);
    }, BUDGET_DEBOUNCE_MS);
  };

  const displayBudget = (category: string, fallback: number) =>
    draftBudgets[category] ?? (fallback > 0 ? String(fallback) : "");

  /** Manual edits take priority — drop any pending (unsaved) suggestion for that field. */
  const updateDraft = (category: string, value: string) => {
    setDraftBudgets((prev) => ({ ...prev, [category]: value }));
    setDirtyKeys((prev) => ({ ...prev, [category]: true }));
    setPendingSuggestions((prev) => {
      if (!(category in prev)) return prev;
      const next = { ...prev };
      delete next[category];
      return next;
    });
    scheduleCommit(category);
  };

  const stagePending = (pending: Record<string, number>, verb: string, emptyMessage: string) => {
    const applied = Object.keys(pending).length;
    if (applied > 0) {
      setDraftBudgets((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(pending)) next[key] = String(value);
        return next;
      });
      setDirtyKeys((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(pending)) next[key] = true;
        return next;
      });
      setPendingSuggestions(pending);
    }
    setSuggestMessage(
      applied > 0
        ? `${verb} ${applied} empty ${applied === 1 ? "category" : "categories"} — review, then save.`
        : emptyMessage
    );
  };

  const applySuggestions = () => {
    const expenseSuggestions = suggestExpenseBudgetsFromPersonal(ledger.rows, month);
    const incomeSuggestions = suggestIncomeBudgetsFromPersonal(ledger.rows, month);

    const pending: Record<string, number> = {};
    for (const row of expenseRows) {
      if (row.budgetChf > 0) continue;
      const suggested = expenseSuggestions[row.cat];
      if (!suggested) continue;
      pending[row.cat] = suggested;
    }
    for (const row of incomeRows) {
      if (row.budgetChf > 0) continue;
      const suggested = incomeSuggestions[row.cat];
      if (!suggested) continue;
      pending[row.key] = suggested;
    }
    stagePending(pending, "Suggested", "Not enough history yet — add a few months of transactions first.");
  };

  const carryForwardBudgets = () => {
    const prevMonth = shiftMonth(month, -1);
    const pending: Record<string, number> = {};
    for (const row of expenseRows) {
      if (row.budgetChf > 0) continue;
      const prior = saved.find((b) => b.month === prevMonth && b.category === row.cat);
      if (!prior || prior.budgetChf <= 0) continue;
      pending[row.cat] = prior.budgetChf;
    }
    for (const row of incomeRows) {
      if (row.budgetChf > 0) continue;
      const prior = saved.find((b) => b.month === prevMonth && b.category === row.key);
      if (!prior || prior.budgetChf <= 0) continue;
      pending[row.key] = prior.budgetChf;
    }
    stagePending(pending, "Copied", "No budget set last month to copy.");
  };

  const saveSuggestions = () => {
    const entries = Object.entries(pendingSuggestions);
    for (const [key, value] of entries) void setBudget(key, value);
    setPendingSuggestions({});
    setSuggestMessage(
      `Saved ${entries.length} suggested ${entries.length === 1 ? "category" : "categories"}.`
    );
  };

  const discardSuggestions = () => {
    setDraftBudgets((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(pendingSuggestions)) next[key] = "";
      return next;
    });
    setPendingSuggestions({});
    setSuggestMessage(null);
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">{t("budgetTitle")}</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2 max-w-2xl">{t("budgetIntro")}</p>
        <p className="text-xs text-[var(--pp-on-surface-variant)] mt-1">{t("budgetSpentExplain")}</p>
      </section>

      <div className="flex flex-wrap gap-3 items-center text-xs">
        <select
          className="pp-input rounded px-2 py-1"
          value={mode}
          onChange={(e) => void persistMode(e.target.value as LabBudgetMode)}
          aria-label={t("budgetModeLabel")}
        >
          <option value="traditional">{t("traditional")}</option>
          <option value="zero-based">{t("zeroBased")}</option>
        </select>
        {finLoading && <span className="text-[var(--pp-on-surface-variant)]">{t("loadingLedger")}</span>}
        {!uid && <span className="text-[var(--pp-primary)]">{t("localBudgetCache")}</span>}
        {syncError ? (
          <span className="text-[var(--pp-error)]" title={syncError}>
            Saved on this device — cloud sync failed
          </span>
        ) : null}
        <button
          type="button"
          onClick={applySuggestions}
          className="flex items-center gap-1.5 bg-[var(--pp-primary)]/10 text-[var(--pp-primary)] font-semibold px-3 py-1 rounded-full hover:bg-[var(--pp-primary)]/20 transition-colors"
        >
          <Wand2 className="size-3.5" />
          Suggest from history
        </button>
        <button
          type="button"
          onClick={carryForwardBudgets}
          className="flex items-center gap-1.5 bg-[var(--pp-primary)]/10 text-[var(--pp-primary)] font-semibold px-3 py-1 rounded-full hover:bg-[var(--pp-primary)]/20 transition-colors"
        >
          <CopyPlus className="size-3.5" />
          Copy last month
        </button>
        {Object.keys(pendingSuggestions).length > 0 && (
          <>
            <button
              type="button"
              onClick={saveSuggestions}
              className="bg-[var(--pp-primary)] text-[var(--pp-on-primary)] font-semibold px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
            >
              Save suggested budgets
            </button>
            <button
              type="button"
              onClick={discardSuggestions}
              className="text-[var(--pp-on-surface-variant)] underline hover:text-[var(--pp-on-surface)]"
            >
              Discard
            </button>
          </>
        )}
        {suggestMessage && (
          <span className="text-[var(--pp-on-surface-variant)]">{suggestMessage}</span>
        )}
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
                        <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
                          {t("expected")} · {t("received")}: {formatChfDisplay(row.received, { prefix: false })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold pp-tabular text-[var(--pp-primary)]">
                        {formatChfDisplay(row.budgetChf)}
                      </p>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="pp-input w-28 text-right text-xs py-0.5 px-1 mt-1"
                        value={displayBudget(row.key, row.budgetChf)}
                        onChange={(e) => updateDraft(row.key, e.target.value)}
                        onBlur={() => commitBudgetDraft(row.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        aria-label={t(personalIncomeLabelKey(row.cat))}
                        placeholder="0.00"
                      />
                      <div className="pp-progress-track h-1 w-28 ml-auto mt-1">
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
            <div className="flex justify-between items-center mb-2">
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
            <p className="text-[11px] text-[var(--pp-on-surface-variant)] mb-4">{t("budgetSpentExplain")}</p>

            {(
              [
                { titleKey: "budgetFixedGroup", cats: PERSONAL_EXPENSE_FIXED },
                { titleKey: "budgetVariableGroup", cats: PERSONAL_EXPENSE_VARIABLE },
                { titleKey: "budgetSavingsGroup", cats: PERSONAL_EXPENSE_SAVINGS },
              ] as const
            ).map((group) => (
              <div key={group.titleKey} className="mb-5 last:mb-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pp-on-surface-variant)] mb-3">
                  {t(group.titleKey)}
                </h3>
                <div className="space-y-4">
                  {group.cats.map((cat) => {
                    const row = expenseRows.find((r) => r.cat === cat);
                    if (!row) return null;
                    return (
                      <ExpenseRow
                        key={row.cat}
                        label={t(personalExpenseLabelKey(row.cat))}
                        budgetInput={displayBudget(row.cat, row.budgetChf)}
                        spent={row.spent}
                        onBudgetInputChange={(v) => updateDraft(row.cat, v)}
                        onBudgetCommit={() => commitBudgetDraft(row.cat)}
                        Icon={EXPENSE_ICONS[row.cat]}
                        href={row.cat === "BILLS" ? billsHref : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

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
              <h2 className="text-lg font-semibold">{t("budgetModeLabel")}</h2>
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
                <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
                  {mode === "zero-based" ? t("budgetModeZeroDesc") : t("budgetModeTraditionalDesc")}
                </p>
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
