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
    description: data.description,
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
  addIncome: (date: string, type: 'SALES' | 'RESERVATION', amount: number, description: string | undefined, sessionId: string, documentId?: string) => Promise<Income | null>;
  addExpense: (date: string, category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER', amount: number, description: string, sessionId: string, employeeId?: string, documentId?: string) => Promise<Expense | null>;
  updateIncome: (id: string, updates: Partial<Omit<Income, 'id' | 'restaurant_id' | 'created_at'>>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'restaurant_id' | 'created_at'>>) => Promise<void>;
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
  }, [user?.uid]);

  useEffect(() => {
    fetchFinances();
  }, [fetchFinances]);

  const addIncome = useCallback(
    async (date: string, type: 'SALES' | 'RESERVATION', amount: number, description: string | undefined, sessionId: string, documentId?: string): Promise<Income | null> => {
      const uid = user?.uid;
      if (!uid || !db) {
        console.error('addIncome failed: No user or database');
        throw new Error('User not authenticated or database not available');
      }
      if (!sessionId) {
        console.error('addIncome failed: No session ID provided');
        throw new Error('Session ID is required');
      }
      try {
        console.log('addIncome: Creating document with sessionId:', sessionId, 'documentId:', documentId);
        const ref = await addDoc(collection(db, INCOME_COLLECTION), {
          restaurantId: uid,
          sessionId,
          date,
          type,
          amount,
          description: description || '',
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
          description,
          document_id: documentId,
          created_at: new Date().toISOString(),
        };
        setIncome((prev) => [newIncome, ...prev]);
        console.log('addIncome: Success, new income ID:', ref.id);
        return newIncome;
      } catch (err) {
        console.error('addIncome error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        throw new Error('Failed to add income: ' + errorMsg);
      }
    },
    [user?.uid]
  );

  const addExpense = useCallback(
    async (date: string, category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER', amount: number, description: string, sessionId: string, employeeId?: string, documentId?: string): Promise<Expense | null> => {
      const uid = user?.uid;
      if (!uid || !db) {
        console.error('addExpense failed: No user or database');
        throw new Error('User not authenticated or database not available');
      }
      if (!sessionId) {
        console.error('addExpense failed: No session ID provided');
        throw new Error('Session ID is required');
      }
      try {
        console.log('addExpense: Creating document with sessionId:', sessionId, 'documentId:', documentId);
        const ref = await addDoc(collection(db, EXPENSE_COLLECTION), {
          restaurantId: uid,
          sessionId,
          date,
          category,
          amount,
          description,
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
          description,
          employee_id: employeeId,
          document_id: documentId,
          created_at: new Date().toISOString(),
        };
        setExpenses((prev) => [newExpense, ...prev]);
        console.log('addExpense: Success, new expense ID:', ref.id);
        return newExpense;
      } catch (err) {
        console.error('addExpense error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        throw new Error('Failed to add expense: ' + errorMsg);
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

  const updateIncome = useCallback(async (id: string, updates: Partial<Omit<Income, 'id' | 'restaurant_id' | 'created_at'>>) => {
    if (!db) return;
    try {
      const { updateDoc, doc: docRef } = await import('firebase/firestore');
      const updateData: any = {};
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.session_id !== undefined) updateData.sessionId = updates.session_id;
      if (updates.document_id !== undefined) updateData.documentId = updates.document_id;
      
      await updateDoc(docRef(db, INCOME_COLLECTION, id), updateData);
      
      setIncome((prev) => prev.map((item) => 
        item.id === id ? { ...item, ...updates } : item
      ));
    } catch (err) {
      console.error('Update income error:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const updateExpense = useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'restaurant_id' | 'created_at'>>) => {
    if (!db) return;
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
      
      await updateDoc(docRef(db, EXPENSE_COLLECTION, id), updateData);
      
      setExpenses((prev) => prev.map((item) => 
        item.id === id ? { ...item, ...updates } : item
      ));
    } catch (err) {
      console.error('Update expense error:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const value: FinanceContextValue = {
    income,
    expenses,
    loading,
    error,
    addIncome,
    addExpense,
    updateIncome,
    updateExpense,
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
