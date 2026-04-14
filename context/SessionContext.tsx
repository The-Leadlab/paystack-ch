import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  getDocs,
  deleteDoc,
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
      const q = query(
        collection(db, SESSIONS_COLLECTION),
        where('restaurantId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const list: Session[] = [];
      snapshot.forEach((doc) => {
        list.push(docToSession(doc.id, doc.data()));
      });
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
    const initSessions = async () => {
      await fetchSessions();
      
      // Auto-create first session if none exist
      if (user?.uid && sessions.length === 0 && !loading) {
        console.log('Auto-creating first session...');
        await addSession();
      }
    };
    
    initSessions();
  }, [user?.uid]);

  const addSession = useCallback(
    async (name?: string): Promise<Session | null> => {
      const uid = user?.uid;
      if (!uid) return null;
      if (!db) {
        setError('Firebase Firestore is not configured.');
        return null;
      }

      // Auto-generate name with timestamp if not provided
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

  const deleteSession = useCallback(
    async (id: string) => {
      if (!db) return;
      try {
        await deleteDoc(doc(db, SESSIONS_COLLECTION, id));
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (currentSession?.id === id) {
          const remaining = sessions.filter(s => s.id !== id);
          setCurrentSessionState(remaining[0] || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentSession, sessions]
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
