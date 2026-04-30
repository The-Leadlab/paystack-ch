import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ProcessedDocument } from '../types';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';

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
          snapshot = await getDocs(
            query(docsRef, where('restaurantId', '==', uid), orderBy('created_at', 'desc'))
          );
        } catch (orderedErr: any) {
          // Fallback avoids blocking document list when index is missing.
          snapshot = await getDocs(query(docsRef, where('restaurantId', '==', uid)));
          console.warn('Documents ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        }
      } else if (currentSession) {
        // Show only documents for current session
        console.log('Fetching documents for session:', currentSession.id);
        try {
          snapshot = await getDocs(
            query(
              docsRef,
              where('restaurantId', '==', uid),
              where('session_id', '==', currentSession.id),
              orderBy('created_at', 'desc')
            )
          );
        } catch (orderedErr: any) {
          snapshot = await getDocs(
            query(
              docsRef,
              where('restaurantId', '==', uid),
              where('session_id', '==', currentSession.id)
            )
          );
          console.warn('Session documents ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        }
      } else {
        console.log('No session selected, skipping fetch');
        setDocuments([]);
        setLoading(false);
        return;
      }

      const docs: ProcessedDocument[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProcessedDocument));
      docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      
      console.log('Fetched documents:', docs.length);
      if (docs.length > 0) {
        console.log('Sample document:', docs[0]);
      }
      
      setDocuments(docs);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      const message = err?.code ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
      setError(message);
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
        const docData = {
          ...document,
          restaurantId: uid,
          session_id: sessionId,
          created_at: new Date().toISOString(),
        };
        
        const docRef = await addDoc(collection(db, 'documents'), docData);
        const newDoc = { ...docData, id: docRef.id };
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
        await updateDoc(docRef, updates as any);
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
