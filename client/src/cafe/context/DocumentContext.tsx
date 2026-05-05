import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ProcessedDocument } from '../types';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = removeUndefinedDeep(v);
      }
    }
    return cleaned as T;
  }
  return value;
}

type DocumentContextValue = {
  documents: ProcessedDocument[];
  loading: boolean;
  error: string | null;
  addDocument: (document: ProcessedDocument) => Promise<ProcessedDocument>;
  updateDocumentData: (documentId: string, updates: Partial<ProcessedDocument>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
};

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentSession, isAllSessionsView } = useSession();
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const uid = user?.uid;
    
    console.log('=== FETCH DOCUMENTS DEBUG ===');
    console.log('User ID:', uid);
    console.log('Current Session:', currentSession);
    console.log('Is All Sessions View:', isAllSessionsView);
    
    if (!uid || !db) {
      console.log('No user or db, skipping fetch');
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const docsRef = collection(db, 'documents');
      let snapshot;

      if (isAllSessionsView) {
        // Show all documents for this restaurant
        console.log('Fetching ALL documents for restaurant');
        try {
          snapshot = await getDocs(query(docsRef, where('restaurantId', '==', uid), orderBy('created_at', 'desc')));
        } catch (orderedErr: any) {
          snapshot = await getDocs(query(docsRef, where('restaurantId', '==', uid)));
          console.warn('Documents ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        }
      } else if (currentSession) {
        // Show only documents for current session
        console.log('Fetching documents for session:', currentSession.id);
        try {
          snapshot = await getDocs(
            query(docsRef, where('restaurantId', '==', uid), where('session_id', '==', currentSession.id), orderBy('created_at', 'desc'))
          );
        } catch (orderedErr: any) {
          snapshot = await getDocs(
            query(docsRef, where('restaurantId', '==', uid), where('session_id', '==', currentSession.id))
          );
          console.warn('Session documents ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        }
      } else {
        console.log('No session selected, skipping fetch');
        setDocuments([]);
        setLoading(false);
        return;
      }

      const docs: ProcessedDocument[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const firestoreId = docSnap.id;
        const storedPersisted = data.persistedDocumentId;
        return {
          ...data,
          id: firestoreId,
          persistedDocumentId:
            typeof storedPersisted === 'string' && storedPersisted.length > 0 ? storedPersisted : firestoreId,
        } as ProcessedDocument;
      });
      docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      
      console.log('Fetched documents:', docs.length);
      if (docs.length > 0) {
        console.log('Sample document:', docs[0]);
      }
      
      setDocuments(docs);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err instanceof Error ? err.message : String(err));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, currentSession?.id, isAllSessionsView]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback(
    async (document: ProcessedDocument): Promise<ProcessedDocument> => {
      const uid = user?.uid;
      const sessionId = currentSession?.id;
      
      if (!uid || !sessionId || !db) {
        throw new Error('User or session not found');
      }

      try {
        const { id: _clientId, ...documentFields } = document;
        const rawDocData = {
          ...documentFields,
          restaurantId: uid,
          restaurant_id: uid,
          userId: uid,
          uid,
          session_id: sessionId,
          created_at: new Date().toISOString(),
        };
        const docData = removeUndefinedDeep(rawDocData);

        const docRef = await addDoc(collection(db, 'documents'), docData);
        const firestoreId = docRef.id;
        const newDoc = { ...docData, id: firestoreId, persistedDocumentId: firestoreId };
        setDocuments((prev) => [newDoc, ...prev]);
        return newDoc; // Return the document with its ID
      } catch (err) {
        console.error('Error adding document:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [user?.uid, currentSession?.id]
  );

  const updateDocumentData = useCallback(
    async (documentId: string, updates: Partial<ProcessedDocument>) => {
      if (!db) return;
      
      try {
        const docRef = doc(db, 'documents', documentId);
        const cleanedUpdates = removeUndefinedDeep(updates);
        await updateDoc(docRef, cleanedUpdates as any);
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, ...updates } : d))
        );
      } catch (err) {
        console.error('Error updating document:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    []
  );

  const deleteDocument = useCallback(async (documentId: string) => {
    if (!db) return;
    
    try {
      const docRef = doc(db, 'documents', documentId);
      await deleteDoc(docRef);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const value: DocumentContextValue = {
    documents,
    loading,
    error,
    addDocument,
    updateDocumentData,
    deleteDocument,
    refreshDocuments: fetchDocuments,
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentProvider');
  return ctx;
}
