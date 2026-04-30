import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Session } from '../types';
import { useAuth } from './AuthContext';

const SESSIONS_COLLECTION = 'sessions';
const LAST_SESSION_KEY = 'cdlp_last_session_id';

function docToSession(id: string, data: any): Session {
  return {
    id,
    restaurant_id: data.restaurantId,
    name: data.name,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    is_active: data.isActive || false,
    is_pinned: data.isPinned || false,
  };
}

type SessionContextValue = {
  sessions: Session[];
  currentSession: Session | null;
  loading: boolean;
  error: string | null;
  addSession: (name?: string) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newName: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  refreshSessions: () => Promise<void>;
  isAllSessionsView: boolean;
  setAllSessionsView: (value: boolean) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAllSessionsView, setAllSessionsView] = useState(false);

  const addSession = useCallback(
    async (name?: string): Promise<Session | null> => {
      const uid = user?.uid;
      if (!uid) return null;
      if (!db) {
        setError('Firebase Firestore is not configured.');
        return null;
      }

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const sessionName = name || timestamp;

      try {
        const ref = await addDoc(collection(db, SESSIONS_COLLECTION), {
          restaurantId: uid,
          name: sessionName,
          isActive: true,
          isPinned: false,
          createdAt: serverTimestamp(),
        });
        const newSession: Session = {
          id: ref.id,
          restaurant_id: uid,
          name: sessionName,
          created_at: new Date().toISOString(),
          is_active: true,
          is_pinned: false,
        };
        setSessions((prev) => [newSession, ...prev]);
        setCurrentSessionState(newSession);
        localStorage.setItem(LAST_SESSION_KEY, ref.id);
        return newSession;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [user?.uid]
  );

  const fetchSessions = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    if (!db) {
      setError('Firebase Firestore is not configured.');
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let snapshot;
      try {
        snapshot = await getDocs(
          query(
            collection(db, SESSIONS_COLLECTION),
            where('restaurantId', '==', uid),
            orderBy('createdAt', 'desc')
          )
        );
      } catch (orderedErr: any) {
        snapshot = await getDocs(
          query(
            collection(db, SESSIONS_COLLECTION),
            where('restaurantId', '==', uid)
          )
        );
        console.warn('Ordered sessions query failed, using fallback query:', orderedErr?.code || orderedErr);
      }
      const list: Session[] = [];
      snapshot.forEach((doc) => {
        list.push(docToSession(doc.id, doc.data()));
      });
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setSessions(list);

      // Resume last active session
      if (list.length > 0 && !currentSession) {
        const lastSessionId = localStorage.getItem(LAST_SESSION_KEY);
        const lastSession = list.find(s => s.id === lastSessionId) || list[0];
        setCurrentSessionState(lastSession);
      }
    } catch (err) {
      console.error('fetchSessions error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, currentSession]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!user?.uid || loading || sessions.length > 0) return;
    const ensureFirstSession = async () => {
      await addSession();
    };
    ensureFirstSession();
  }, [user?.uid, loading, sessions.length, addSession]);

  const deleteSession = useCallback(
    async (id: string) => {
      const uid = user?.uid;
      if (!db || !uid) return;
      try {
        const { collection, getDocs, query, where, deleteDoc: fsDeleteDoc } = await import('firebase/firestore');
        const incomeIds = new Set<string>();
        const expenseIds = new Set<string>();
        const posIds = new Set<string>();
        const documentIds = new Set<string>();
        const collect = async (q: any, target: Set<string>) => {
          const snap = await getDocs(q);
          snap.forEach((d) => target.add(d.id));
        };

        // Income (new + legacy fields)
        await collect(query(collection(db, 'income'), where('restaurantId', '==', uid), where('sessionId', '==', id)), incomeIds);
        await collect(query(collection(db, 'income'), where('restaurantId', '==', uid), where('session_id', '==', id)), incomeIds);
        // Expenses
        await collect(query(collection(db, 'expenses'), where('restaurantId', '==', uid), where('sessionId', '==', id)), expenseIds);
        await collect(query(collection(db, 'expenses'), where('restaurantId', '==', uid), where('session_id', '==', id)), expenseIds);
        // POS
        await collect(query(collection(db, 'pos_readings'), where('restaurant_id', '==', uid), where('session_id', '==', id)), posIds);
        await collect(query(collection(db, 'pos_readings'), where('restaurantId', '==', uid), where('sessionId', '==', id)), posIds);
        // Documents
        await collect(query(collection(db, 'documents'), where('restaurantId', '==', uid), where('session_id', '==', id)), documentIds);
        await collect(query(collection(db, 'documents'), where('restaurantId', '==', uid), where('sessionId', '==', id)), documentIds);

        // Delete children first to satisfy strict rules.
        for (const incomeId of incomeIds) {
          await fsDeleteDoc(doc(db, 'income', incomeId)).catch(() => {});
        }
        for (const expenseId of expenseIds) {
          await fsDeleteDoc(doc(db, 'expenses', expenseId)).catch(() => {});
        }
        for (const posId of posIds) {
          await fsDeleteDoc(doc(db, 'pos_readings', posId)).catch(() => {});
        }
        for (const documentId of documentIds) {
          await fsDeleteDoc(doc(db, 'documents', documentId)).catch(() => {});
        }

        await fsDeleteDoc(doc(db, SESSIONS_COLLECTION, id));
        
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (currentSession?.id === id) {
          const remaining = sessions.filter(s => s.id !== id);
          setCurrentSessionState(remaining[0] || null);
        }
        
        console.log(`✅ Session ${id} and all associated data deleted`);
      } catch (err) {
        console.error('Delete session error:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentSession, sessions, user?.uid]
  );

  const renameSession = useCallback(
    async (id: string, newName: string) => {
      if (!db) return;
      try {
        await updateDoc(doc(db, SESSIONS_COLLECTION, id), { name: newName });
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
        );
        if (currentSession?.id === id) {
          setCurrentSessionState({ ...currentSession, name: newName });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentSession]
  );

  const setCurrentSession = useCallback((session: Session | null) => {
    setCurrentSessionState(session);
    if (session) {
      localStorage.setItem(LAST_SESSION_KEY, session.id);
      // Only set isAllSessionsView to false when selecting a specific session
      setAllSessionsView(false);
    }
    // Don't change isAllSessionsView when setting to null - let the caller control it
  }, []);

  const value: SessionContextValue = {
    sessions,
    currentSession,
    loading,
    error,
    addSession,
    deleteSession,
    renameSession,
    setCurrentSession,
    refreshSessions: fetchSessions,
    isAllSessionsView,
    setAllSessionsView,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
