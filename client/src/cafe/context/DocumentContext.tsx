import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ProcessedDocument } from '../types';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useDataWriteAccess } from '../hooks/useDataWriteAccess';
import { useSession } from './SessionContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy, deleteField } from 'firebase/firestore';
import { dedupeProcessedDocuments } from '../lib/dedupeProcessedDocuments';
import { packDocumentUpdatesForFirestore } from '../lib/financialDataFirestorePayload';
import {
  lineItemsConflictWithDocument,
  repairLineItemsToDocumentDirection,
} from '@shared/documentDirection';

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

/** Prefer camelCase; accept legacy snake_case (same as income/expenses). */
function resolveDocumentSessionId(data: Record<string, unknown> | null | undefined): string {
  if (!data) return '';
  const camel = data.sessionId;
  const snake = data.session_id;
  if (typeof camel === 'string' && camel) return camel;
  if (typeof snake === 'string' && snake) return snake;
  return '';
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
  const { dataOwnerUid } = useWorkspace();
  const canWrite = useDataWriteAccess();
  const { currentSession, isAllSessionsView } = useSession();
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const uid = dataOwnerUid;
    
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

      if (!isAllSessionsView && !currentSession) {
        console.log('No session selected, skipping fetch');
        setDocuments([]);
        setLoading(false);
        return;
      }

      // Always load restaurant docs, then filter by session client-side.
      // Avoids empty lists when Firestore only has `sessionId` (camelCase),
      // composite indexes are missing, or team members hit query failures.
      console.log(
        isAllSessionsView
          ? 'Fetching ALL documents for restaurant'
          : `Fetching documents for session (client filter): ${currentSession!.id}`
      );
      try {
        snapshot = await getDocs(query(docsRef, where('restaurantId', '==', uid), orderBy('created_at', 'desc')));
      } catch (orderedErr: any) {
        try {
          snapshot = await getDocs(query(docsRef, where('restaurantId', '==', uid)));
          console.warn('Documents ordered query failed, using fallback query:', orderedErr?.code || orderedErr);
        } catch (fallbackErr: any) {
          // Legacy docs may only have restaurant_id
          snapshot = await getDocs(query(docsRef, where('restaurant_id', '==', uid)));
          console.warn('Documents restaurantId query failed, trying restaurant_id:', fallbackErr?.code || fallbackErr);
        }
      }

      let rawDocs: ProcessedDocument[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const firestoreId = docSnap.id;
        const storedPersisted = data.persistedDocumentId;
        const sessionResolved = resolveDocumentSessionId(data);
        return {
          ...data,
          id: firestoreId,
          session_id: sessionResolved || (typeof data.session_id === 'string' ? data.session_id : undefined),
          persistedDocumentId:
            typeof storedPersisted === 'string' && storedPersisted.length > 0 ? storedPersisted : firestoreId,
        } as ProcessedDocument;
      });

      if (!isAllSessionsView && currentSession) {
        const sid = currentSession.id;
        rawDocs = rawDocs.filter((d) => {
          const docSid = resolveDocumentSessionId(d as unknown as Record<string, unknown>) || d.session_id || '';
          return docSid === sid;
        });
      }

      const { keepers, duplicateIds } = dedupeProcessedDocuments(rawDocs);
      keepers.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

      console.log('Fetched documents:', keepers.length, duplicateIds.length ? `(removed ${duplicateIds.length} duplicates)` : '');
      if (keepers.length > 0) {
        console.log('Sample document:', keepers[0]);
      }

      const repairedKeepers = keepers.map((d) => {
        if (!d.data) return d;
        if (!lineItemsConflictWithDocument(d.data, { fileName: d.fileName })) return d;
        return {
          ...d,
          data: repairLineItemsToDocumentDirection(d.data, { fileName: d.fileName }),
        };
      });
      setDocuments(repairedKeepers);

      if (canWrite && db) {
        const database = db;
        const uid = dataOwnerUid || '';
        void (async () => {
          for (let i = 0; i < keepers.length; i += 1) {
            const original = keepers[i];
            const next = repairedKeepers[i];
            if (!original?.id || !next?.data || next.data === original.data) continue;
            try {
              const packed = await packDocumentUpdatesForFirestore(original.id, uid, { data: next.data });
              await updateDoc(doc(database, 'documents', original.id), removeUndefinedDeep(packed.forFirestore) as any);
            } catch (repairErr) {
              console.warn('Could not persist line-type repair for', original.id, repairErr);
            }
          }
        })();
      }

      // Best-effort cleanup of orphan pending twins left by Drive re-import / double-queue
      if (duplicateIds.length > 0 && db && canWrite) {
        const database = db;
        void (async () => {
          for (const id of duplicateIds) {
            try {
              await deleteDoc(doc(database, 'documents', id));
            } catch (cleanupErr) {
              console.warn('Could not delete duplicate document', id, cleanupErr);
            }
          }
        })();
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err instanceof Error ? err.message : String(err));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [dataOwnerUid, canWrite, currentSession?.id, isAllSessionsView]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback(
    async (document: ProcessedDocument): Promise<ProcessedDocument> => {
      const uid = dataOwnerUid;
      const sessionId = currentSession?.id;
      
      if (!uid || !canWrite || !sessionId || !db) {
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
          // Prefer caller-supplied session (upload may finish after the user switched sessions).
          // Write both field names so session filters work for members and legacy readers.
          session_id: (typeof document.session_id === 'string' && document.session_id) || sessionId,
          sessionId: (typeof document.session_id === 'string' && document.session_id) || sessionId,
          created_at: new Date().toISOString(),
        };

        // Temporary id for Storage sidecar path when lineItems are huge (CSV bank imports).
        const stagingId =
          typeof document.persistedDocumentId === 'string' && document.persistedDocumentId
            ? document.persistedDocumentId
            : `pending_${Date.now()}`;
        const packed = await packDocumentUpdatesForFirestore(stagingId, uid, rawDocData);
        const docData = removeUndefinedDeep(packed.forFirestore);

        const docRef = await addDoc(collection(db, 'documents'), docData);
        const firestoreId = docRef.id;
        const localFields = removeUndefinedDeep({
          ...packed.forLocal,
          id: firestoreId,
          persistedDocumentId: firestoreId,
        }) as ProcessedDocument;
        const newDoc = { ...localFields, id: firestoreId, persistedDocumentId: firestoreId };
        setDocuments((prev) => [newDoc, ...prev]);
        return newDoc;
      } catch (err) {
        console.error('Error adding document:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [dataOwnerUid, canWrite, currentSession?.id]
  );

  const updateDocumentData = useCallback(
    async (documentId: string, updates: Partial<ProcessedDocument>) => {
      if (!db || !canWrite) return;
      const uid = dataOwnerUid || '';
      
      try {
        const packed = await packDocumentUpdatesForFirestore(documentId, uid, updates);
        const docRef = doc(db, 'documents', documentId);
        const cleanedUpdates = removeUndefinedDeep(packed.forFirestore) as Record<string, unknown>;
        const existing = documents.find((d) => d.id === documentId);
        const clearingError =
          Object.prototype.hasOwnProperty.call(updates, 'error') && !updates.error;
        const resolving =
          updates.status != null &&
          updates.status !== 'error' &&
          Boolean(existing?.error || existing?.errorCode || existing?.lastError);
        if ((clearingError || resolving) && (existing?.error || existing?.errorCode)) {
          const now = new Date().toISOString();
          cleanedUpdates.lastError = existing.error ?? existing.lastError ?? null;
          cleanedUpdates.lastErrorCode = existing.errorCode ?? existing.lastErrorCode ?? null;
          cleanedUpdates.lastErrorAt = now;
          if (updates.status === 'completed' || updates.status === 'needs_review') {
            cleanedUpdates.errorResolvedAt = now;
          }
          cleanedUpdates.error = deleteField();
          cleanedUpdates.errorCode = deleteField();
        }
        await updateDoc(docRef, cleanedUpdates as any);
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, ...packed.forLocal } : d))
        );
      } catch (err) {
        console.error('Error updating document:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [canWrite, dataOwnerUid, documents]
  );

  const deleteDocument = useCallback(async (documentId: string) => {
    if (!db || !canWrite) return;
    
    try {
      const docRef = doc(db, 'documents', documentId);
      await deleteDoc(docRef);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [canWrite]);

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
