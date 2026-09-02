import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Income, Expense } from '../types';
import { suggestSwissAccountCode } from '@shared/suggestSwissAccountCode';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useDataWriteAccess } from '../hooks/useDataWriteAccess';

const INCOME_COLLECTION = 'income';
const EXPENSE_COLLECTION = 'expenses';
/** Firestore writeBatch limit is 500; stay under for safety. */
const BATCH_WRITE_LIMIT = 400;

export type LedgerIncomeDraft = {
  date: string;
  type: 'SALES' | 'RESERVATION';
  amount: number;
  description?: string;
  sessionId: string;
  documentId?: string;
  vatAmount?: number;
  accountCode?: string;
};

export type LedgerExpenseDraft = {
  date: string;
  category: Expense['category'];
  amount: number;
  description: string;
  sessionId: string;
  employeeId?: string;
  documentId?: string;
  vatAmount?: number;
  accountCode?: string;
};

function docToIncome(id: string, data: any): Income {
  return {
    id,
    restaurant_id: data.restaurantId,
    session_id: data.sessionId || '',
    date: data.date,
    type: data.type,
    amount: data.amount,
    vat_amount: data.vatAmount || 0,
    description: data.description,
    account_code: data.accountCode || undefined,
    document_id: data.documentId,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  };
}

function docToExpense(id: string, data: any): Expense {
  return {
    id,
    restaurant_id: data.restaurantId,
    session_id: data.sessionId || '',
    date: data.date,
    category: data.category,
    amount: data.amount,
    vat_amount: data.vatAmount || 0,
    description: data.description,
    account_code: data.accountCode || undefined,
    employee_id: data.employeeId,
    document_id: data.documentId,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  };
}

type FinanceContextValue = {
  income: Income[];
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  addIncome: (date: string, type: 'SALES' | 'RESERVATION', amount: number, description: string | undefined, sessionId: string, documentId?: string, vatAmount?: number, accountCode?: string) => Promise<Income | null>;
  addExpense: (date: string, category: Expense['category'], amount: number, description: string, sessionId: string, employeeId?: string, documentId?: string, vatAmount?: number, accountCode?: string) => Promise<Expense | null>;
  /** Bulk write for CSV / bank-statement imports — one UI update after all rows land. */
  addLedgerEntriesBatch: (
    incomeDrafts: LedgerIncomeDraft[],
    expenseDrafts: LedgerExpenseDraft[]
  ) => Promise<{ income: Income[]; expenses: Expense[] }>;
  updateIncome: (id: string, updates: Partial<Omit<Income, 'id' | 'restaurant_id' | 'created_at'>>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'restaurant_id' | 'created_at'>>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  /** Remove all income/expense rows created from a processed document. */
  deleteFinancesByDocumentId: (documentId: string) => Promise<{ income: number; expenses: number }>;
  refreshFinances: () => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { dataOwnerUid } = useWorkspace();
  const canWrite = useDataWriteAccess();
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinances = useCallback(async () => {
    const uid = dataOwnerUid;
    if (!uid || !db) {
      setIncome([]);
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [incomeSnap, expenseSnap] = await Promise.all([
        getDocs(query(collection(db, INCOME_COLLECTION), where('restaurantId', '==', uid))),
        getDocs(query(collection(db, EXPENSE_COLLECTION), where('restaurantId', '==', uid))),
      ]);
      
      const incomeList: Income[] = [];
      incomeSnap.forEach((doc) => incomeList.push(docToIncome(doc.id, doc.data())));
      
      const expenseList: Expense[] = [];
      expenseSnap.forEach((doc) => expenseList.push(docToExpense(doc.id, doc.data())));
      
      console.log('=== FINANCE CONTEXT FETCH ===');
      console.log('Loaded income items:', incomeList.length);
      console.log('Loaded expense items:', expenseList.length);
      console.log('Sample income:', incomeList[0]);
      console.log('Sample expense:', expenseList[0]);
      
      setIncome(incomeList);
      setExpenses(expenseList);
    } catch (err) {
      console.error('fetchFinances error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [dataOwnerUid]);

  useEffect(() => {
    fetchFinances();
  }, [fetchFinances]);

  const addIncome = useCallback(
    async (date: string, type: 'SALES' | 'RESERVATION', amount: number, description: string | undefined, sessionId: string, documentId?: string, vatAmount?: number, accountCode?: string): Promise<Income | null> => {
      const uid = dataOwnerUid;
      if (!uid || !canWrite || !db) {
        console.error('addIncome failed: No user or database');
        throw new Error('User not authenticated or database not available');
      }
      if (!sessionId) {
        console.error('addIncome failed: No session ID provided');
        throw new Error('Session ID is required');
      }
      try {
        const resolvedAccountCode =
          accountCode ||
          suggestSwissAccountCode({
            kind: 'income',
            incomeType: type,
            description: description || '',
          });
        console.log('addIncome: Creating document with sessionId:', sessionId, 'documentId:', documentId, 'VAT:', vatAmount);
        const ref = await addDoc(collection(db, INCOME_COLLECTION), {
          restaurantId: uid,
          sessionId,
          date,
          type,
          amount,
          vatAmount: vatAmount || 0,
          description: description || '',
          accountCode: resolvedAccountCode || null,
          documentId: documentId || null,
          createdAt: serverTimestamp(),
        });
        const newIncome: Income = {
          id: ref.id,
          restaurant_id: uid,
          session_id: sessionId,
          date,
          type,
          amount,
          vat_amount: vatAmount || 0,
          description,
          account_code: resolvedAccountCode,
          document_id: documentId,
          created_at: new Date().toISOString(),
        };
        setIncome((prev) => [newIncome, ...prev]);
        return newIncome;
      } catch (err) {
        console.error('addIncome error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        throw new Error('Failed to add income: ' + errorMsg);
      }
    },
    [dataOwnerUid, canWrite]
  );

  const addExpense = useCallback(
    async (date: string, category: Expense['category'], amount: number, description: string, sessionId: string, employeeId?: string, documentId?: string, vatAmount?: number, accountCode?: string): Promise<Expense | null> => {
      const uid = dataOwnerUid;
      if (!uid || !canWrite || !db) {
        console.error('addExpense failed: No user or database');
        throw new Error('User not authenticated or database not available');
      }
      if (!sessionId) {
        console.error('addExpense failed: No session ID provided');
        throw new Error('Session ID is required');
      }
      try {
        const resolvedAccountCode =
          accountCode ||
          suggestSwissAccountCode({
            kind: 'expense',
            category,
            description,
          });
        const ref = await addDoc(collection(db, EXPENSE_COLLECTION), {
          restaurantId: uid,
          sessionId,
          date,
          category,
          amount,
          vatAmount: vatAmount || 0,
          description,
          accountCode: resolvedAccountCode || null,
          employeeId: employeeId || null,
          documentId: documentId || null,
          createdAt: serverTimestamp(),
        });
        const newExpense: Expense = {
          id: ref.id,
          restaurant_id: uid,
          session_id: sessionId,
          date,
          category,
          amount,
          vat_amount: vatAmount || 0,
          description,
          account_code: resolvedAccountCode,
          employee_id: employeeId,
          document_id: documentId,
          created_at: new Date().toISOString(),
        };
        setExpenses((prev) => [newExpense, ...prev]);
        return newExpense;
      } catch (err) {
        console.error('addExpense error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        throw new Error('Failed to add expense: ' + errorMsg);
      }
    },
    [dataOwnerUid, canWrite]
  );

  const addLedgerEntriesBatch = useCallback(
    async (
      incomeDrafts: LedgerIncomeDraft[],
      expenseDrafts: LedgerExpenseDraft[]
    ): Promise<{ income: Income[]; expenses: Expense[] }> => {
      const uid = dataOwnerUid;
      if (!uid || !canWrite || !db) {
        throw new Error('User not authenticated or database not available');
      }
      if (incomeDrafts.length === 0 && expenseDrafts.length === 0) {
        return { income: [], expenses: [] };
      }

      const createdIncome: Income[] = [];
      const createdExpenses: Expense[] = [];
      const ops: Array<{ kind: 'income' | 'expense'; ref: ReturnType<typeof doc>; payload: Record<string, unknown>; local: Income | Expense }> = [];

      for (const draft of incomeDrafts) {
        if (!draft.sessionId) throw new Error('Session ID is required');
        const resolvedAccountCode =
          draft.accountCode ||
          suggestSwissAccountCode({
            kind: 'income',
            incomeType: draft.type,
            description: draft.description || '',
          });
        const ref = doc(collection(db, INCOME_COLLECTION));
        const payload = {
          restaurantId: uid,
          sessionId: draft.sessionId,
          date: draft.date,
          type: draft.type,
          amount: draft.amount,
          vatAmount: draft.vatAmount || 0,
          description: draft.description || '',
          accountCode: resolvedAccountCode || null,
          documentId: draft.documentId || null,
          createdAt: serverTimestamp(),
        };
        const local: Income = {
          id: ref.id,
          restaurant_id: uid,
          session_id: draft.sessionId,
          date: draft.date,
          type: draft.type,
          amount: draft.amount,
          vat_amount: draft.vatAmount || 0,
          description: draft.description,
          account_code: resolvedAccountCode,
          document_id: draft.documentId,
          created_at: new Date().toISOString(),
        };
        ops.push({ kind: 'income', ref, payload, local });
        createdIncome.push(local);
      }

      for (const draft of expenseDrafts) {
        if (!draft.sessionId) throw new Error('Session ID is required');
        const resolvedAccountCode =
          draft.accountCode ||
          suggestSwissAccountCode({
            kind: 'expense',
            category: draft.category,
            description: draft.description,
          });
        const ref = doc(collection(db, EXPENSE_COLLECTION));
        const payload = {
          restaurantId: uid,
          sessionId: draft.sessionId,
          date: draft.date,
          category: draft.category,
          amount: draft.amount,
          vatAmount: draft.vatAmount || 0,
          description: draft.description,
          accountCode: resolvedAccountCode || null,
          employeeId: draft.employeeId || null,
          documentId: draft.documentId || null,
          createdAt: serverTimestamp(),
        };
        const local: Expense = {
          id: ref.id,
          restaurant_id: uid,
          session_id: draft.sessionId,
          date: draft.date,
          category: draft.category,
          amount: draft.amount,
          vat_amount: draft.vatAmount || 0,
          description: draft.description,
          account_code: resolvedAccountCode,
          employee_id: draft.employeeId,
          document_id: draft.documentId,
          created_at: new Date().toISOString(),
        };
        ops.push({ kind: 'expense', ref, payload, local });
        createdExpenses.push(local);
      }

      for (let i = 0; i < ops.length; i += BATCH_WRITE_LIMIT) {
        const chunk = ops.slice(i, i + BATCH_WRITE_LIMIT);
        const batch = writeBatch(db);
        for (const op of chunk) {
          batch.set(op.ref, op.payload);
        }
        await batch.commit();
      }

      // Single React update so dashboard/report totals jump once, not row-by-row.
      if (createdIncome.length) {
        setIncome((prev) => [...createdIncome, ...prev]);
      }
      if (createdExpenses.length) {
        setExpenses((prev) => [...createdExpenses, ...prev]);
      }

      console.log(
        `addLedgerEntriesBatch: +${createdIncome.length} income, +${createdExpenses.length} expenses`
      );
      return { income: createdIncome, expenses: createdExpenses };
    },
    [dataOwnerUid, canWrite]
  );

  const deleteIncome = useCallback(async (id: string) => {
    if (!db || !canWrite) return;
    try {
      await deleteDoc(doc(db, INCOME_COLLECTION, id));
      setIncome((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [canWrite]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!db || !canWrite) return;
    try {
      await deleteDoc(doc(db, EXPENSE_COLLECTION, id));
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [canWrite]);

  const deleteFinancesByDocumentId = useCallback(
    async (documentId: string): Promise<{ income: number; expenses: number }> => {
      const uid = dataOwnerUid;
      if (!db || !uid || !canWrite || !documentId) {
        return { income: 0, expenses: 0 };
      }

      const incomeIds = new Set<string>();
      const expenseIds = new Set<string>();

      income
        .filter((i) => i.document_id === documentId)
        .forEach((i) => incomeIds.add(i.id));
      expenses
        .filter((e) => e.document_id === documentId)
        .forEach((e) => expenseIds.add(e.id));

      try {
        const [incomeSnap, expenseSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, INCOME_COLLECTION),
              where('restaurantId', '==', uid),
              where('documentId', '==', documentId)
            )
          ),
          getDocs(
            query(
              collection(db, EXPENSE_COLLECTION),
              where('restaurantId', '==', uid),
              where('documentId', '==', documentId)
            )
          ),
        ]);

        incomeSnap.forEach((d) => incomeIds.add(d.id));
        expenseSnap.forEach((d) => expenseIds.add(d.id));

        await Promise.all([
          ...[...incomeIds].map((id) => deleteDoc(doc(db, INCOME_COLLECTION, id))),
          ...[...expenseIds].map((id) => deleteDoc(doc(db, EXPENSE_COLLECTION, id))),
        ]);

        setIncome((prev) => prev.filter((i) => i.document_id !== documentId));
        setExpenses((prev) => prev.filter((e) => e.document_id !== documentId));

        return { income: incomeIds.size, expenses: expenseIds.size };
      } catch (err) {
        console.error('deleteFinancesByDocumentId error:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [dataOwnerUid, canWrite, income, expenses]
  );

  const updateIncome = useCallback(async (id: string, updates: Partial<Omit<Income, 'id' | 'restaurant_id' | 'created_at'>>) => {
    if (!db || !canWrite) return;
    try {
      const { updateDoc, doc: docRef } = await import('firebase/firestore');
      const updateData: any = {};
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.session_id !== undefined) updateData.sessionId = updates.session_id;
      if (updates.document_id !== undefined) updateData.documentId = updates.document_id;
      if (updates.account_code !== undefined) updateData.accountCode = updates.account_code || null;
      
      await updateDoc(docRef(db, INCOME_COLLECTION, id), updateData);
      
      setIncome((prev) => prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ));
    } catch (err) {
      console.error('Update income error:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [canWrite]);

  const updateExpense = useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'restaurant_id' | 'created_at'>>) => {
    if (!db || !canWrite) return;
    try {
      const { updateDoc, doc: docRef } = await import('firebase/firestore');
      const updateData: any = {};
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.session_id !== undefined) updateData.sessionId = updates.session_id;
      if (updates.employee_id !== undefined) updateData.employeeId = updates.employee_id;
      if (updates.document_id !== undefined) updateData.documentId = updates.document_id;
      if (updates.account_code !== undefined) updateData.accountCode = updates.account_code || null;
      
      await updateDoc(docRef(db, EXPENSE_COLLECTION, id), updateData);
      
      setExpenses((prev) => prev.map((item) => 
        item.id === id ? { ...item, ...updates } : item
      ));
    } catch (err) {
      console.error('Update expense error:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [canWrite]);

  const value: FinanceContextValue = {
    income,
    expenses,
    loading,
    error,
    addIncome,
    addExpense,
    addLedgerEntriesBatch,
    updateIncome,
    updateExpense,
    deleteIncome,
    deleteExpense,
    deleteFinancesByDocumentId,
    refreshFinances: fetchFinances,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
