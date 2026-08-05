/**
 * Shared personal finance ledger in Firestore (restaurantId = workspace owner uid).
 * Used when signed in so invited teammates see the same household money data.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import type { PersonalBudgetTx, PersonalImportRecord } from "./personalBudgetStore";
import type { PersonalStatementDraft } from "./personalStatementImport";

export const PERSONAL_TX_COLLECTION = "personal_transactions";
export const PERSONAL_IMPORTS_COLLECTION = "personal_imports";

function stripUndefined<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function listPersonalTransactionsFs(
  firestore: Firestore,
  ownerUid: string
): Promise<PersonalBudgetTx[]> {
  const snap = await getDocs(
    query(collection(firestore, PERSONAL_TX_COLLECTION), where("restaurantId", "==", ownerUid))
  );
  const rows = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: String(data.date || ""),
      description: String(data.description || ""),
      amount: Number(data.amount) || 0,
      kind: data.kind === "income" ? "income" : "expense",
      expenseCat: data.expenseCat,
      incomeCat: data.incomeCat,
      source: data.source === "statement" ? "statement" : "manual",
      importId: typeof data.importId === "string" ? data.importId : undefined,
      createdAt: String(data.createdAt || new Date().toISOString()),
    } as PersonalBudgetTx;
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function listPersonalImportsFs(
  firestore: Firestore,
  ownerUid: string
): Promise<PersonalImportRecord[]> {
  const snap = await getDocs(
    query(collection(firestore, PERSONAL_IMPORTS_COLLECTION), where("restaurantId", "==", ownerUid))
  );
  const rows = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      fileName: String(data.fileName || ""),
      source: (data.source as PersonalImportRecord["source"]) || "csv",
      importedAt: String(data.importedAt || ""),
      rowCount: Number(data.rowCount) || 0,
      incomeTotal: Number(data.incomeTotal) || 0,
      expenseTotal: Number(data.expenseTotal) || 0,
    } satisfies PersonalImportRecord;
  });
  return rows.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function addPersonalTransactionFs(
  firestore: Firestore,
  ownerUid: string,
  input: Omit<PersonalBudgetTx, "id" | "createdAt"> & { id?: string }
): Promise<PersonalBudgetTx> {
  const row: PersonalBudgetTx = {
    ...input,
    id: input.id || `ptx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(firestore, PERSONAL_TX_COLLECTION, row.id), {
    ...stripUndefined(row as unknown as Record<string, unknown>),
    restaurantId: ownerUid,
  });
  return row;
}

export async function updatePersonalTransactionFs(
  firestore: Firestore,
  ownerUid: string,
  id: string,
  patch: Partial<Pick<PersonalBudgetTx, "amount" | "description" | "date" | "kind" | "expenseCat" | "incomeCat">>
): Promise<void> {
  const ref = doc(firestore, PERSONAL_TX_COLLECTION, id);
  await setDoc(
    ref,
    {
      ...stripUndefined(patch as Record<string, unknown>),
      restaurantId: ownerUid,
    },
    { merge: true }
  );
}

export async function deletePersonalTransactionFs(firestore: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(firestore, PERSONAL_TX_COLLECTION, id));
}

export async function commitPersonalStatementDraftsFs(
  firestore: Firestore,
  ownerUid: string,
  drafts: PersonalStatementDraft[],
  meta: { fileName: string; source: "csv" | "pdf" | "image" }
): Promise<PersonalImportRecord> {
  const selected = drafts.filter((d) => d.selected && d.amount > 0);
  const importId = `pim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const importedAt = new Date().toISOString();
  let incomeTotal = 0;
  let expenseTotal = 0;

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
    await setDoc(doc(firestore, PERSONAL_TX_COLLECTION, row.id), {
      ...stripUndefined(row as unknown as Record<string, unknown>),
      restaurantId: ownerUid,
    });
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
  await setDoc(doc(firestore, PERSONAL_IMPORTS_COLLECTION, importId), {
    ...record,
    restaurantId: ownerUid,
  });
  return record;
}
