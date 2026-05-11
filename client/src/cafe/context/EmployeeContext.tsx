import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Employee } from '../types';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useLanguage } from './LanguageContext';

const EMPLOYEES_COLLECTION = 'employees';

function docToEmployee(id: string, data: any): Employee {
  return {
    id,
    restaurant_id: data.restaurantId,
    name: data.name,
    position: data.position,
    monthly_salary: data.monthlySalary,
    social_contributions: data.socialContributions,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  };
}

type EmployeeContextValue = {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  addEmployee: (name: string, position?: string, salary?: number, contributions?: number) => Promise<Employee | null>;
  deleteEmployee: (id: string) => Promise<void>;
  refreshEmployees: () => Promise<void>;
};

const EmployeeContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { enforcementEnabled, entitlements } = useSubscription();
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    if (!db) {
      setError('Firebase Firestore is not configured.');
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, EMPLOYEES_COLLECTION),
        where('restaurantId', '==', uid)
      );
      const snapshot = await getDocs(q);
      const list: Employee[] = [];
      snapshot.forEach((doc) => {
        list.push(docToEmployee(doc.id, doc.data()));
      });
      setEmployees(list);
    } catch (err) {
      console.error('fetchEmployees error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const addEmployee = useCallback(
    async (name: string, position?: string, salary?: number, contributions?: number): Promise<Employee | null> => {
      const uid = user?.uid;
      if (!uid) return null;
      if (!db) {
        setError('Firebase Firestore is not configured.');
        return null;
      }
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (
        enforcementEnabled &&
        entitlements.maxEmployeeSlots != null &&
        employees.length >= entitlements.maxEmployeeSlots
      ) {
        setError(t('planLimitEmployees').replace('{n}', String(entitlements.maxEmployeeSlots)));
        return null;
      }
      try {
        const ref = await addDoc(collection(db, EMPLOYEES_COLLECTION), {
          restaurantId: uid,
          name: trimmed,
          position: position?.trim() || '',
          monthlySalary: salary || 0,
          socialContributions: contributions || 0,
          createdAt: serverTimestamp(),
        });
        const newEmployee: Employee = {
          id: ref.id,
          restaurant_id: uid,
          name: trimmed,
          position: position?.trim(),
          monthly_salary: salary,
          social_contributions: contributions,
          created_at: new Date().toISOString(),
        };
        setEmployees((prev) => [newEmployee, ...prev]);
        return newEmployee;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [user?.uid, enforcementEnabled, entitlements.maxEmployeeSlots, employees.length, t]
  );

  const deleteEmployee = useCallback(
    async (id: string) => {
      if (!db) return;
      try {
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
        setEmployees((prev) => prev.filter((e) => e.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    []
  );

  const value: EmployeeContextValue = {
    employees,
    loading,
    error,
    addEmployee,
    deleteEmployee,
    refreshEmployees: fetchEmployees,
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error('useEmployee must be used within EmployeeProvider');
  return ctx;
}
