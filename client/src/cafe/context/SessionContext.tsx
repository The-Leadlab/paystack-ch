import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
import { useSubscription } from './SubscriptionContext';
import { useLanguage } from './LanguageContext';
import { defaultSessionName } from '../lib/formatLocalDateTime';

const SESSIONS_COLLECTION = 'sessions';
const LAST_SESSION_KEY = 'cdlp_last_session_id';
const OWNER_FIELDS = ['restaurantId', 'restaurant_id'] as const;
const SESSION_FIELDS = ['sessionId', 'session_id'] as const;
const SESSION_CHILD_COLLECTIONS = ['income', 'expenses', 'pos_readings', 'documents'] as const;

function docBelongsToUser(data: Record<string, unknown>, uid: string): boolean {
  return OWNER_FIELDS.some((field) => data[field] === uid);
}

function docBelongsToSession(data: Record<string, unknown>, sessionId: string): boolean {
  return SESSION_FIELDS.some((field) => data[field] === sessionId);
}

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
  deleteSession: (id: string) => Promise<{ ok: boolean; message?: string }>;
  renameSession: (id: string, newName: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  refreshSessions: () => Promise<void>;
  isAllSessionsView: boolean;
  setAllSessionsView: (value: boolean) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { enforcementEnabled, entitlements } = useSubscription();
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAllSessionsView, setAllSessionsView] = useState(false);
  const currentSessionRef = useRef<Session | null>(null);
  const initialBootstrapDoneRef = useRef(false);
  currentSessionRef.current = currentSession;

  const addSession = useCallback(
    async (name?: string): Promise<Session | null> => {
      const uid = user?.uid;
      if (!uid) return null;
      if (!db) {
        setError('Firebase Firestore is not configured.');
        return null;
      }

      const sessionName = name || defaultSessionName();

      if (enforcementEnabled && entitlements.maxSessions != null && sessions.length >= entitlements.maxSessions) {
        setError(t('planLimitSessions').replace('{n}', String(entitlements.maxSessions)));
        return null;
      }

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
    [user?.uid, enforcementEnabled, entitlements.maxSessions, sessions.length, t]
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

      // Resume last active session (ref avoids stale closure / refetch loops)
      if (list.length > 0 && !currentSessionRef.current) {
        const lastSessionId = localStorage.getItem(LAST_SESSION_KEY);
        const lastSession = list.find((s) => s.id === lastSessionId) || list[0];
        setCurrentSessionState(lastSession);
        localStorage.setItem(LAST_SESSION_KEY, lastSession.id);
      }
    } catch (err) {
      console.error('fetchSessions error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    initialBootstrapDoneRef.current = false;
  }, [user?.uid]);

  /** Create the first session only for brand-new accounts — not after the user deletes the last one. */
  useEffect(() => {
    if (!user?.uid || loading) return;
    if (sessions.length > 0) {
      initialBootstrapDoneRef.current = true;
      return;
    }
    if (initialBootstrapDoneRef.current) return;
    initialBootstrapDoneRef.current = true;
    void addSession();
  }, [user?.uid, loading, sessions.length, addSession]);

  const deleteSession = useCallback(
    async (id: string): Promise<{ ok: boolean; message?: string }> => {
      const uid = user?.uid;
      if (!db || !uid) {
        const message = 'Firebase Firestore is not configured.';
        setError(message);
        return { ok: false, message };
      }
      try {
        setError(null);
        const { collection, getDocs, query, where, deleteDoc: fsDeleteDoc, doc } =
          await import('firebase/firestore');
        type DocumentReference = import('firebase/firestore').DocumentReference;

        const childRefs: DocumentReference[] = [];
        const seenPaths = new Set<string>();

        const pushRef = (ref: DocumentReference) => {
          if (seenPaths.has(ref.path)) return;
          seenPaths.add(ref.path);
          childRefs.push(ref);
        };

        for (const collectionName of SESSION_CHILD_COLLECTIONS) {
          for (const ownerField of OWNER_FIELDS) {
            try {
              const snap = await getDocs(
                query(collection(db, collectionName), where(ownerField, '==', uid))
              );
              snap.forEach((d) => {
                const data = d.data() as Record<string, unknown>;
                if (!docBelongsToUser(data, uid) || !docBelongsToSession(data, id)) return;
                pushRef(d.ref);
              });
            } catch (queryErr) {
              console.warn(`Session delete: query ${collectionName}.${ownerField} failed`, queryErr);
            }
          }
        }

        const deleteFailures: string[] = [];
        for (const ref of childRefs) {
          try {
            await fsDeleteDoc(ref);
          } catch (deleteErr) {
            console.error(`Session delete: failed to remove ${ref.path}`, deleteErr);
            deleteFailures.push(ref.path);
          }
        }

        await fsDeleteDoc(doc(db, SESSIONS_COLLECTION, id));

        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== id);
          if (currentSessionRef.current?.id === id) {
            const newCurrent = next[0] ?? null;
            setCurrentSessionState(newCurrent);
            if (newCurrent) localStorage.setItem(LAST_SESSION_KEY, newCurrent.id);
            else localStorage.removeItem(LAST_SESSION_KEY);
          }
          return next;
        });

        if (deleteFailures.length > 0) {
          const message = `Session removed, but ${deleteFailures.length} linked record(s) could not be deleted. Refresh and try again if needed.`;
          setError(message);
        }

        console.log(`✅ Session ${id} deleted (${childRefs.length} linked records processed)`);
        return { ok: true, message: deleteFailures.length > 0 ? deleteFailures.join(', ') : undefined };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Delete session error:', err);
        setError(message);
        return { ok: false, message };
      }
    },
    [user?.uid]
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
