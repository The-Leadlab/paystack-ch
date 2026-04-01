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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Income, Expense } from '../types';
import { useAuth } from './AuthContext';

const INCOME_COLLECTION = 'income';
const EXPENSE_COLLECTION = 'expenses';

function docToIncome(id: string, data: any): Income {
  return {
    id,
    restaurant_id: data.restaurantId,
    session_id: data.sessionId || '',
    date: data.date,
    type: data.type,
    amount: data.amount,
    description: data.description,
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
    description: data.description,
    employee_id: data.employeeId,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  };
}

type FinanceContextValue = {
  income: Income[];
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  addIncome: (date: string, type: 'SALES' | 'RESERVATION', amount: number, description: string | undefined, sessionId: string) => Promise<Income | null>;
  addExpense: (date: string, category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER', amount: number, description: string, sessionId: string, employeeId?: string) => Promise<Expense | null>;
  deleteIncome: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refreshFinances: () => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinances = useCallback(async () => {
    const uid = user?.uid;
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
      
      setIncome(incomeList);
      setExpenses(expenseList);
    } catch (err) {
      console.error('fetchFinances error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchFinances();
  }, [fetchFinances]);

  const addIncome = useCallback(
    async (date: string, type: 'SALES' | 'RESERVATION', amount: number, description: string | undefined, sessionId: string): Promise<Income | null> => {
      const uid = user?.uid;
      if (!uid || !db) return null;
      try {
        const ref = await addDoc(collection(db, INCOME_COLLECTION), {
          restaurantId: uid,
          sessionId,
          date,
          type,
          amount,
          description: description || '',
          createdAt: serverTimestamp(),
        });
        const newIncome: Income = {
          id: ref.id,
          restaurant_id: uid,
          session_id: sessionId,
          date,
          type,
          amount,
          description,
          created_at: new Date().toISOString(),
        };
        setIncome((prev) => [newIncome, ...prev]);
        return newIncome;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [user?.uid]
  );

  const addExpense = useCallback(
    async (date: string, category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER', amount: number, description: string, sessionId: string, employeeId?: string): Promise<Expense | null> => {
      const uid = user?.uid;
      if (!uid || !db) return null;
      try {
        const ref = await addDoc(collection(db, EXPENSE_COLLECTION), {
          restaurantId: uid,
          sessionId,
          date,
          category,
          amount,
          description,
          employeeId: employeeId || null,
          createdAt: serverTimestamp(),
        });
        const newExpense: Expense = {
          id: ref.id,
          restaurant_id: uid,
          session_id: sessionId,
          date,
          category,
          amount,
          description,
          employee_id: employeeId,
          created_at: new Date().toISOString(),
        };
        setExpenses((prev) => [newExpense, ...prev]);
        return newExpense;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [user?.uid]
  );

  const deleteIncome = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, INCOME_COLLECTION, id));
      setIncome((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, EXPENSE_COLLECTION, id));
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const value: FinanceContextValue = {
    income,
    expenses,
    loading,
    error,
    addIncome,
    addExpense,
    deleteIncome,
    deleteExpense,
    refreshFinances: fetchFinances,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
