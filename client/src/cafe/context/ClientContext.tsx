import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Client } from '../types';
import { useAuth } from './AuthContext';

const CURRENT_CLIENT_KEY = 'ypsom_current_client_id';
const CLIENTS_COLLECTION = 'clients';

function docToClient(id: string, data: { userId: string; name: string; createdAt: Timestamp }): Client {
  return {
    id,
    user_id: data.userId,
    name: data.name,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  };
}

type ClientContextValue = {
  clients: Client[];
  currentClient: Client | null;
  loading: boolean;
  error: string | null;
  setCurrentClient: (client: Client | null) => void;
  addClient: (name: string) => Promise<Client | null>;
  refreshClients: () => Promise<void>;
};

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [currentClient, setCurrentClientState] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setClients([]);
      setLoading(false);
      return;
    }
    if (!db) {
      setError('Firebase Firestore is not configured.');
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let snapshot;
      try {
        // Requires composite index on (userId ASC, createdAt DESC)
        const q = query(
          collection(db, CLIENTS_COLLECTION),
          where('userId', '==', uid),
          orderBy('createdAt', 'desc')
        );
        snapshot = await getDocs(q);
      } catch {
        // Fallback: query without orderBy in case the index isn't deployed yet
        const q = query(
          collection(db, CLIENTS_COLLECTION),
          where('userId', '==', uid)
        );
        snapshot = await getDocs(q);
      }
      const list: Client[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as { userId: string; name: string; createdAt: Timestamp };
        list.push(docToClient(doc.id, data));
      });
      setClients(list);
    } catch (err) {
      console.error('fetchClients error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (clients.length === 0) return; // don't wipe currentClient on empty fetch
    const savedId = localStorage.getItem(CURRENT_CLIENT_KEY);
    if (savedId) {
      const found = clients.find((c) => c.id === savedId);
      if (found) setCurrentClient(found);
    }
  }, [clients]);

  const setCurrentClient = useCallback((client: Client | null) => {
    setCurrentClientState(client);
    if (client) {
      localStorage.setItem(CURRENT_CLIENT_KEY, client.id);
    } else {
      localStorage.removeItem(CURRENT_CLIENT_KEY);
    }
  }, []);

  const addClient = useCallback(
    async (name: string): Promise<Client | null> => {
      const uid = user?.uid;
      if (!uid) return null;
      if (!db) {
        setError('Firebase Firestore is not configured.');
        return null;
      }
      const trimmed = name.trim();
      if (!trimmed) return null;
      try {
        const ref = await addDoc(collection(db, CLIENTS_COLLECTION), {
          userId: uid,
          name: trimmed,
          createdAt: serverTimestamp(),
        });
        const newClient: Client = {
          id: ref.id,
          user_id: uid,
          name: trimmed,
          created_at: new Date().toISOString(),
        };
        setClients((prev) => [newClient, ...prev]);
        setCurrentClient(newClient);
        return newClient;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [user?.uid, setCurrentClient]
  );

  const value: ClientContextValue = {
    clients,
    currentClient,
    loading,
    error,
    setCurrentClient,
    addClient,
    refreshClients: fetchClients,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClient must be used within ClientProvider');
  return ctx;
}
