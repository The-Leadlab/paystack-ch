import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { POSReading } from '../types';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';

type POSContextValue = {
  posReadings: POSReading[];
  loading: boolean;
  error: string | null;
  addPOSReading: (reading: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePOSReading: (id: string, updates: Partial<POSReading>) => Promise<void>;
  deletePOSReading: (id: string) => Promise<void>;
  refreshPOSReadings: () => Promise<void>;
};

const POSContext = createContext<POSContextValue | null>(null);

export function POSProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentSession, isAllSessionsView } = useSession();
  const [posReadings, setPOSReadings] = useState<POSReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPOSReadings = useCallback(async () => {
    const uid = user?.uid;
    
    if (!uid || !db) {
      setPOSReadings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const posRef = collection(db, 'pos_readings');
      let snapshot;
      
      if (isAllSessionsView) {
        try {
          snapshot = await getDocs(
            query(posRef, where('restaurant_id', '==', uid), orderBy('date', 'desc'))
          );
        } catch (orderedErr: any) {
          snapshot = await getDocs(query(posRef, where('restaurant_id', '==', uid)));
          console.warn('POS ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        }
      } else if (currentSession) {
        try {
          snapshot = await getDocs(
            query(
              posRef,
              where('restaurant_id', '==', uid),
              where('session_id', '==', currentSession.id),
              orderBy('date', 'desc')
            )
          );
        } catch (orderedErr: any) {
          snapshot = await getDocs(
            query(
              posRef,
              where('restaurant_id', '==', uid),
              where('session_id', '==', currentSession.id)
            )
          );
          console.warn('POS session ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        }
      } else {
        setPOSReadings([]);
        setLoading(false);
        return;
      }

      const readings: POSReading[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as POSReading));
      readings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      
      setPOSReadings(readings);
    } catch (err) {
      console.error('Error fetching POS readings:', err);
      setError(err instanceof Error ? err.message : String(err));
      setPOSReadings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, currentSession?.id, isAllSessionsView]);

  useEffect(() => {
    fetchPOSReadings();
  }, [fetchPOSReadings]);

  const addPOSReading = useCallback(
    async (reading: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>) => {
      const uid = user?.uid;
      const sessionId = currentSession?.id;
      
      if (!uid || !sessionId || !db) {
        throw new Error('User or session not found');
      }

      try {
        const now = new Date().toISOString();
        const readingData = {
          ...reading,
          restaurant_id: uid,
          session_id: sessionId,
          created_at: now,
          updated_at: now,
        };
        
        const docRef = await addDoc(collection(db, 'pos_readings'), readingData);
        const newReading = { ...readingData, id: docRef.id };
        setPOSReadings((prev) => [newReading, ...prev]);
      } catch (err) {
        console.error('Error adding POS reading:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [user?.uid, currentSession?.id]
  );

  const updatePOSReading = useCallback(
    async (id: string, updates: Partial<POSReading>) => {
      if (!db) return;
      
      try {
        const docRef = doc(db, 'pos_readings', id);
        const updateData: Record<string, any> = {
          ...updates,
          updated_at: new Date().toISOString(),
        };
        await updateDoc(docRef, updateData);
        setPOSReadings((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updates, updated_at: updateData.updated_at } : r))
        );
      } catch (err) {
        console.error('Error updating POS reading:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    []
  );

  const deletePOSReading = useCallback(async (id: string) => {
    if (!db) return;
    
    try {
      const docRef = doc(db, 'pos_readings', id);
      await deleteDoc(docRef);
      setPOSReadings((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Error deleting POS reading:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const value: POSContextValue = {
    posReadings,
    loading,
    error,
    addPOSReading,
    updatePOSReading,
    deletePOSReading,
    refreshPOSReadings: fetchPOSReadings,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
}
