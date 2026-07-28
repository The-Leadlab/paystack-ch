/** IndexedDB personal budget ledger — isolated from restaurant FinanceContext. */

import type { PersonalExpenseCategory, PersonalIncomeCategory } from "../personalCategories";
import type { PersonalStatementDraft } from "./personalStatementImport";

const DB_NAME = "paystack_personal_budget";
const DB_VERSION = 1;
const STORE_TX = "transactions";
const STORE_IMPORTS = "imports";
export const PERSONAL_BUDGET_CHANGED = "paystack-personal-budget-changed";

function notifyPersonalBudgetChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERSONAL_BUDGET_CHANGED));
  }
}

export type PersonalBudgetTx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: "income" | "expense";
  expenseCat: PersonalExpenseCategory;
  incomeCat: PersonalIncomeCategory;
  source: "statement" | "manual";
  importId?: string;
  createdAt: string;
};

export type PersonalImportRecord = {
  id: string;
  fileName: string;
  source: "csv" | "pdf" | "image";
  importedAt: string;
  rowCount: number;
  incomeTotal: number;
  expenseTotal: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TX)) {
        const tx = db.createObjectStore(STORE_TX, { keyPath: "id" });
        tx.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_IMPORTS)) {
        db.createObjectStore(STORE_IMPORTS, { keyPath: "id" });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
  });
}

export async function listPersonalTransactions(): Promise<PersonalBudgetTx[]> {
  const db = await openDb();
  try {
    const rows = await idbReq(db.transaction(STORE_TX).objectStore(STORE_TX).getAll());
    return (rows as PersonalBudgetTx[]).sort((a, b) => b.date.localeCompare(a.date));
  } finally {
    db.close();
  }
}

export async function listPersonalImports(): Promise<PersonalImportRecord[]> {
  const db = await openDb();
  try {
    const rows = await idbReq(db.transaction(STORE_IMPORTS).objectStore(STORE_IMPORTS).getAll());
    return (rows as PersonalImportRecord[]).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  } finally {
    db.close();
  }
}

export async function addPersonalTransaction(
  input: Omit<PersonalBudgetTx, "id" | "createdAt"> & { id?: string }
): Promise<PersonalBudgetTx> {
  const row: PersonalBudgetTx = {
    ...input,
    id: input.id || `ptx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const db = await openDb();
  try {
    await idbReq(db.transaction(STORE_TX, "readwrite").objectStore(STORE_TX).put(row));
    notifyPersonalBudgetChanged();
    return row;
  } finally {
    db.close();
  }
}

export async function updatePersonalTransaction(
  id: string,
  patch: Partial<Pick<PersonalBudgetTx, "amount" | "description" | "date" | "kind" | "expenseCat" | "incomeCat">>
): Promise<void> {
  const db = await openDb();
  try {
    const store = db.transaction(STORE_TX, "readwrite").objectStore(STORE_TX);
    const existing = (await idbReq(store.get(id))) as PersonalBudgetTx | undefined;
    if (!existing) return;
    await idbReq(store.put({ ...existing, ...patch }));
    notifyPersonalBudgetChanged();
  } finally {
    db.close();
  }
}

export async function deletePersonalTransaction(id: string): Promise<void> {
  const db = await openDb();
  try {
    await idbReq(db.transaction(STORE_TX, "readwrite").objectStore(STORE_TX).delete(id));
    notifyPersonalBudgetChanged();
  } finally {
    db.close();
  }
}

export async function commitPersonalStatementDrafts(
  drafts: PersonalStatementDraft[],
  meta: { fileName: string; source: "csv" | "pdf" | "image" }
): Promise<PersonalImportRecord> {
  const selected = drafts.filter((d) => d.selected && d.amount > 0);
  const importId = `pim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const importedAt = new Date().toISOString();
  let incomeTotal = 0;
  let expenseTotal = 0;

  const db = await openDb();
  try {
    const tx = db.transaction([STORE_TX, STORE_IMPORTS], "readwrite");
    const txStore = tx.objectStore(STORE_TX);
    const importStore = tx.objectStore(STORE_IMPORTS);

    for (let i = 0; i < selected.length; i += 1) {
      const d = selected[i];
      if (d.kind === "income") incomeTotal += d.amount;
      else expenseTotal += d.amount;
      const row: PersonalBudgetTx = {
        id: `ptx_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 9)}`,
        date: d.date,
        description: d.description,
        amount: d.amount,
        kind: d.kind,
        expenseCat: d.expenseCat,
        incomeCat: d.incomeCat,
        source: "statement",
        importId,
        createdAt: importedAt,
      };
      txStore.put(row);
    }

    const record: PersonalImportRecord = {
      id: importId,
      fileName: meta.fileName,
      source: meta.source,
      importedAt,
      rowCount: selected.length,
      incomeTotal,
      expenseTotal,
    };
    importStore.put(record);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Commit failed"));
    });
    notifyPersonalBudgetChanged();
    return record;
  } finally {
    db.close();
  }
}

export function filterPersonalByMonth(rows: PersonalBudgetTx[], month: string): PersonalBudgetTx[] {
  return rows.filter((r) => r.date.startsWith(month));
}

export function computePersonalMonthTotals(rows: PersonalBudgetTx[], month: string) {
  const monthRows = filterPersonalByMonth(rows, month);
  const totalIncome = monthRows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  const totalExpenses = monthRows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  const savings = totalIncome - totalExpenses;
  const savingsRatePct = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
  return {
    rows: monthRows,
    totals: {
      totalIncome,
      totalExpenses,
      savings,
      balance: savings,
      savingsRatePct,
      incomeCount: monthRows.filter((r) => r.kind === "income").length,
      expenseCount: monthRows.filter((r) => r.kind === "expense").length,
    },
  };
}
