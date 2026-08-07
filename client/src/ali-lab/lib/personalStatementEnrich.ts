/**
 * After a personal statement import, seed Bills / Savings goals / Investments / Budget
 * from categorized draft rows (deduped). Writes localStorage + Firestore when allowed.
 */
import { addLabDoc, labCollections, loadLabDocs } from "../aliLabFirestore";
import type { LabBill, LabGoal, LabHolding, LabBudgetLine } from "../types";
import type { PersonalStatementDraft } from "./personalStatementImport";

export type PersonalEnrichResult = {
  billsAdded: number;
  goalsAdded: number;
  holdingsAdded: number;
  budgetsTouched: number;
};

const BILL_HINTS: { match: RegExp; name: string }[] = [
  { match: /swisscom/i, name: "Swisscom" },
  { match: /sunrise/i, name: "Sunrise" },
  { match: /\bsalt\b/i, name: "Salt mobile" },
  { match: /serafe/i, name: "Serafe" },
  { match: /\brent\b|loyer|miete|hypothek|mortgage/i, name: "Rent / housing" },
  { match: /kranken|css|helsana|swica|concordia|visana/i, name: "Health insurance" },
  { match: /fitness|gym|migros.?fitness|pure.?gym/i, name: "Gym / fitness" },
  { match: /electric|ewz|romande.?energie|sig\b|eau|water|gas/i, name: "Utilities" },
];

function nextDueFromDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const n = new Date();
    n.setMonth(n.getMonth() + 1);
    return n.toISOString().slice(0, 10);
  }
  const next = new Date(d);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function localKey(ownerUid: string | undefined, suffix: string): string {
  return `ali-lab-${suffix}-${ownerUid || "anon"}`;
}

function readLocal<T>(ownerUid: string | undefined, suffix: string): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(ownerUid, suffix)) || "[]");
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(ownerUid: string | undefined, suffix: string, items: T[]): void {
  try {
    localStorage.setItem(localKey(ownerUid, suffix), JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

async function persistItem<T extends { id: string }>(
  ownerUid: string | undefined,
  collectionName: string,
  suffix: string,
  item: T
): Promise<void> {
  const local = readLocal<T>(ownerUid, suffix);
  if (!local.some((x) => x.id === item.id)) {
    writeLocal(ownerUid, suffix, [...local, item]);
  }
  if (!ownerUid) return;
  try {
    const { id: _id, ...rest } = item;
    await addLabDoc(ownerUid, collectionName, rest as unknown as Record<string, unknown>);
  } catch {
    // Keep local — cloud rules may deny until redeployed.
  }
}

export async function enrichPersonalFromStatement(
  ownerUid: string | undefined,
  drafts: PersonalStatementDraft[],
  opts?: { month?: string }
): Promise<PersonalEnrichResult> {
  const selected = drafts.filter((d) => d.selected && d.amount > 0);
  const result: PersonalEnrichResult = { billsAdded: 0, goalsAdded: 0, holdingsAdded: 0, budgetsTouched: 0 };
  if (!selected.length) return result;

  const month =
    opts?.month ||
    selected.map((d) => d.date.slice(0, 7)).sort()[Math.floor(selected.length / 2)] ||
    new Date().toISOString().slice(0, 7);

  const income = selected.filter((d) => d.kind === "income").reduce((s, d) => s + d.amount, 0);
  const expense = selected.filter((d) => d.kind === "expense").reduce((s, d) => s + d.amount, 0);
  const savings = income - expense;

  const existingBills = [
    ...(await loadLabDocs<LabBill>(ownerUid, labCollections.bills, "bills").catch(() => [])),
    ...readLocal<LabBill>(ownerUid, "bills"),
  ];
  const billNames = new Set(existingBills.map((b) => b.name.toLowerCase()));
  const seenBill = new Set<string>();

  for (const draft of selected.filter((d) => d.kind === "expense")) {
    for (const hint of BILL_HINTS) {
      if (!hint.match.test(draft.description)) continue;
      const key = hint.name.toLowerCase();
      if (seenBill.has(key) || billNames.has(key)) continue;
      seenBill.add(key);
      const bill: LabBill = {
        id: uid("bill"),
        name: hint.name,
        dueDate: nextDueFromDate(draft.date),
        amountChf: Math.round(draft.amount * 100) / 100,
        recurrence: "monthly",
        remindDaysBefore: 3,
        notes: "Recommended by AI from your bank statement",
      };
      await persistItem(ownerUid, labCollections.bills, "bills", bill);
      result.billsAdded += 1;
    }
  }

  const existingGoals = [
    ...(await loadLabDocs<LabGoal>(ownerUid, labCollections.goals, "goals").catch(() => [])),
    ...readLocal<LabGoal>(ownerUid, "goals"),
  ];
  if (existingGoals.length === 0 && income > 0) {
    const targetEmergency = Math.round(Math.max(income * 3, 3000));
    const targetMonth = Math.round(Math.max(savings * 0.5, income * 0.1, 200));
    const goals: LabGoal[] = [
      {
        id: uid("goal"),
        name: "Emergency fund (AI)",
        targetChf: targetEmergency,
        currentChf: Math.max(0, Math.round(Math.min(Math.max(savings, 0), targetEmergency * 0.1))),
        type: "savings",
        deadline: `${Number(month.slice(0, 4)) + 1}-12-31`,
      },
      {
        id: uid("goal"),
        name: "Monthly save target (AI)",
        targetChf: targetMonth,
        currentChf: Math.max(0, Math.round(Math.min(Math.max(savings, 0), targetMonth))),
        type: "savings",
        deadline: `${month}-28`,
      },
    ];
    for (const g of goals) {
      await persistItem(ownerUid, labCollections.goals, "goals", g);
      result.goalsAdded += 1;
    }
  }

  const existingHoldings = [
    ...(await loadLabDocs<LabHolding>(ownerUid, labCollections.holdings, "holdings").catch(() => [])),
    ...readLocal<LabHolding>(ownerUid, "holdings"),
  ];
  const holdingKeys = new Set(existingHoldings.map((h) => h.symbol.toUpperCase()));
  const investRows = selected.filter(
    (d) =>
      d.expenseCat === "SAVINGS_INVEST" ||
      d.incomeCat === "ASSET_REVENUE" ||
      /viac|frankly|swissquote|pillar|3a|etf|dividend/i.test(d.description)
  );

  for (const row of investRows) {
    let symbol = "CH-INV";
    let name = "Swiss investment (AI)";
    if (/viac/i.test(row.description)) {
      symbol = "VIAC-3A";
      name = "VIAC Pillar 3a (AI)";
    } else if (/frankly/i.test(row.description)) {
      symbol = "FRANKLY-3A";
      name = "Frankly Pillar 3a (AI)";
    } else if (/swissquote/i.test(row.description)) {
      symbol = "SQN";
      name = "Swissquote (AI)";
    } else if (/dividend/i.test(row.description)) {
      symbol = "DIV";
      name = "Dividend portfolio (AI)";
    }
    if (holdingKeys.has(symbol)) continue;
    holdingKeys.add(symbol);
    const amount = row.amount;
    const holding: LabHolding = {
      id: uid("hld"),
      symbol,
      name,
      quantity: 1,
      costBasisChf: amount,
      lastPriceChf: amount,
    };
    await persistItem(ownerUid, labCollections.holdings, "holdings", holding);
    result.holdingsAdded += 1;
  }

  const existingBudgets = [
    ...(await loadLabDocs<LabBudgetLine>(ownerUid, labCollections.budgets, "budgets").catch(() => [])),
    ...readLocal<LabBudgetLine>(ownerUid, "budgets"),
  ];
  const byCat = new Map<string, number>();
  for (const d of selected.filter((x) => x.kind === "expense")) {
    byCat.set(d.expenseCat, (byCat.get(d.expenseCat) || 0) + d.amount);
  }
  for (const [category, spent] of byCat) {
    const already = existingBudgets.some((b) => b.month === month && b.category === category);
    if (already) continue;
    const line: LabBudgetLine = {
      id: uid("bud"),
      month,
      category,
      budgetChf: Math.ceil(spent * 1.05),
      mode: "traditional",
    };
    await persistItem(ownerUid, labCollections.budgets, "budgets", line);
    result.budgetsTouched += 1;
  }

  return result;
}
