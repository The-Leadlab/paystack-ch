/** Gemini helpers for personal statement fill + savings coaching. */

import { generateGeminiContent } from "@/cafe/lib/geminiClient";
import { auth } from "@/cafe/lib/firebase";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../personalCategories";
import type { PersonalBudgetTx } from "./personalBudgetStore";
import type { PersonalStatementDraft } from "./personalStatementImport";
import { SWISS_PERSONAL_FINANCE_AI_CONTEXT } from "./personalSwissTaxAi";

const MODEL = import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export type PersonalSavingsTip = {
  title: string;
  detail: string;
  estimatedMonthlySave: number;
  category?: string;
};

export type PersonalSavingsAdvice = {
  targetSaveChf: number;
  targetSavePct: number;
  summary: string;
  tips: PersonalSavingsTip[];
  source: "ai" | "heuristic";
};

type MonthSnapshot = {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsRatePct: number;
  topExpenses: { label: string; amount: number }[];
};

function stripJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseJson<T>(raw: string): T {
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("Could not parse AI JSON");
  }
}

function canCallGemini(): boolean {
  return Boolean(auth?.currentUser);
}

function isExpenseCat(v: string): v is PersonalExpenseCategory {
  return (PERSONAL_EXPENSE_CATEGORIES as string[]).includes(v);
}

function isIncomeCat(v: string): v is PersonalIncomeCategory {
  return (PERSONAL_INCOME_CATEGORIES as string[]).includes(v);
}

/** Refine kind + categories with Gemini; falls back to drafts unchanged. */
export async function refinePersonalDraftsWithAi(
  drafts: PersonalStatementDraft[]
): Promise<PersonalStatementDraft[]> {
  if (!drafts.length || !canCallGemini()) return drafts;

  const payload = drafts.slice(0, 80).map((d, index) => ({
    index,
    date: d.date,
    description: d.description,
    amount: d.amount,
    kind: d.kind,
  }));

  try {
    const response = await generateGeminiContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SWISS_PERSONAL_FINANCE_AI_CONTEXT}

You classify Swiss household bank transactions for a personal budget app (CHF).
Return ONLY JSON:
{"rows":[{"index":0,"kind":"income"|"expense","expenseCat":"BILLS"|"RENT"|"GROCERIES"|"GOING_OUT"|"SHOPPING_OTHER"|"SAVINGS_INVEST","incomeCat":"SALARY"|"ASSET_REVENUE"|"CONTRIBUTIONS"}]}
Use expenseCat for expenses and incomeCat for income. Prefer Swiss household context (Migros, Coop, Serafe, Swisscom, rent/loyer, Krankenversicherung, pillar 3a).
Transactions:
${JSON.stringify(payload)}`,
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseJson<{ rows?: Array<Record<string, unknown>> }>(response.text || "");
    const byIndex = new Map<number, Record<string, unknown>>();
    for (const row of parsed.rows || []) {
      const idx = Number(row.index);
      if (Number.isFinite(idx)) byIndex.set(idx, row);
    }

    return drafts.map((d, index) => {
      const row = byIndex.get(index);
      if (!row) return d;
      const kind = row.kind === "income" || row.kind === "expense" ? row.kind : d.kind;
      const expenseCat =
        typeof row.expenseCat === "string" && isExpenseCat(row.expenseCat)
          ? row.expenseCat
          : d.expenseCat;
      const incomeCat =
        typeof row.incomeCat === "string" && isIncomeCat(row.incomeCat)
          ? row.incomeCat
          : d.incomeCat;
      return { ...d, kind, expenseCat, incomeCat, selected: true };
    });
  } catch {
    return drafts.map((d) => ({ ...d, selected: true }));
  }
}

function buildTopExpenses(rows: PersonalBudgetTx[], month: string): { label: string; amount: number }[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== "expense" || !r.date.startsWith(month)) continue;
    const label = r.expenseCat;
    sums.set(label, (sums.get(label) || 0) + r.amount);
  }
  return [...sums.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

export function buildMonthSnapshot(
  month: string,
  totals: {
    totalIncome: number;
    totalExpenses: number;
    savings: number;
    savingsRatePct: number;
  },
  rows: PersonalBudgetTx[]
): MonthSnapshot {
  return {
    month,
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    savings: totals.savings,
    savingsRatePct: totals.savingsRatePct,
    topExpenses: buildTopExpenses(rows, month),
  };
}

export function heuristicPersonalSavingsAdvice(snap: MonthSnapshot): PersonalSavingsAdvice {
  const income = Math.max(0, snap.totalIncome);
  const idealPct = 20;
  const ideal = Math.round((income * idealPct) / 100);
  const current = Math.max(0, snap.savings);
  const gap = Math.max(0, ideal - current);
  const targetSaveChf = income > 0 ? Math.max(ideal, Math.round(income * 0.1)) : 0;
  const targetSavePct = income > 0 ? Math.round((targetSaveChf / income) * 100) : 0;

  const tips: PersonalSavingsTip[] = snap.topExpenses.slice(0, 3).map((cat) => {
    const cut = Math.round(cat.amount * 0.15);
    return {
      title: `Trim ${cat.label}`,
      detail: `Your ${cat.label} spend is about CHF ${cat.amount.toFixed(0)} this month. Cutting ~15% frees roughly CHF ${cut.toFixed(0)}.`,
      estimatedMonthlySave: cut,
      category: cat.label,
    };
  });

  if (!tips.length) {
    tips.push({
      title: "Start a weekly transfer",
      detail: "Move a fixed CHF amount to savings the day after payday so spending adjusts to what remains.",
      estimatedMonthlySave: Math.round(targetSaveChf / 4) || 50,
    });
  }

  if (gap > 0) {
    tips.unshift({
      title: "Close the savings gap",
      detail: `Aim for ~${idealPct}% of income. You are about CHF ${gap.toFixed(0)} short of that target this month.`,
      estimatedMonthlySave: gap,
    });
  }

  return {
    targetSaveChf,
    targetSavePct,
    summary:
      income > 0
        ? `Target about CHF ${targetSaveChf.toFixed(0)} (${targetSavePct}% of income) this month.`
        : "Add income or upload a statement so we can suggest a savings target.",
    tips,
    source: "heuristic",
  };
}

export async function suggestPersonalSavingsAdvice(snap: MonthSnapshot): Promise<PersonalSavingsAdvice> {
  const fallback = heuristicPersonalSavingsAdvice(snap);
  if (!canCallGemini() || snap.totalIncome <= 0) return fallback;

  try {
    const response = await generateGeminiContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SWISS_PERSONAL_FINANCE_AI_CONTEXT}

You are a practical Swiss personal-finance coach for families (CHF household budget — not a restaurant business).
Consider Swiss realities: health insurance premiums, rent/Nebenkosten, pillar 3a room if relevant, and realistic discretionary cuts.
Given this month snapshot, suggest how MUCH to save and HOW to save.
Return ONLY JSON:
{
  "targetSaveChf": number,
  "targetSavePct": number,
  "summary": "1-2 sentences",
  "tips": [{"title":"string","detail":"string","estimatedMonthlySave":number,"category":"optional"}]
}
Rules: 3-5 tips, concrete, CHF estimates realistic vs expenses, no investment advice that requires brokerage, no guilt tone.
Snapshot: ${JSON.stringify(snap)}`,
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseJson<{
      targetSaveChf?: number;
      targetSavePct?: number;
      summary?: string;
      tips?: Array<Record<string, unknown>>;
    }>(response.text || "");

    const tips: PersonalSavingsTip[] = (parsed.tips || [])
      .map((tip) => ({
        title: String(tip.title || "Tip").slice(0, 80),
        detail: String(tip.detail || "").slice(0, 400),
        estimatedMonthlySave: Math.max(0, Number(tip.estimatedMonthlySave) || 0),
        category: tip.category ? String(tip.category) : undefined,
      }))
      .filter((t) => t.detail)
      .slice(0, 5);

    const targetSaveChf = Math.max(0, Number(parsed.targetSaveChf) || fallback.targetSaveChf);
    const targetSavePct =
      snap.totalIncome > 0
        ? Math.min(80, Math.max(0, Number(parsed.targetSavePct) || Math.round((targetSaveChf / snap.totalIncome) * 100)))
        : 0;

    return {
      targetSaveChf,
      targetSavePct,
      summary: String(parsed.summary || fallback.summary).slice(0, 320),
      tips: tips.length ? tips : fallback.tips,
      source: "ai",
    };
  } catch {
    return fallback;
  }
}
