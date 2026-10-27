import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ProcessedDocument } from '../types';
import { useWorkspace } from './WorkspaceContext';
import { useDataWriteAccess } from '../hooks/useDataWriteAccess';
import { useSession } from './SessionContext';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
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
export function resolveDocumentSessionId(data: Record<string, unknown> | null | undefined): string {
  if (!data) return '';
  const camel = data.sessionId;
  const snake = data.session_id;
  if (typeof camel === 'string' && camel.trim()) return camel.trim();
  if (typeof snake === 'string' && snake.trim()) return snake.trim();
  return '';
}

function resolveCreatedAt(data: Record<string, unknown>): string {
  const snake = data.created_at;
  const camel = data.createdAt;
  if (typeof snake === 'string' && snake) return snake;
  if (typeof camel === 'string' && camel) return camel;
  return '';
}

function mapSnapshotDocs(snapshot: QuerySnapshot<DocumentData>): ProcessedDocument[] {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const firestoreId = docSnap.id;
    const storedPersisted = data.persistedDocumentId;
    const sessionResolved = resolveDocumentSessionId(data);
    const created = resolveCreatedAt(data);
    return {
      ...data,
      id: firestoreId,
      session_id: sessionResolved || undefined,
      sessionId: sessionResolved || undefined,
      created_at: created || (typeof data.created_at === 'string' ? data.created_at : undefined),
      persistedDocumentId:
        typeof storedPersisted === 'string' && storedPersisted.length > 0 ? storedPersisted : firestoreId,
    } as ProcessedDocument;
  });
}

/**
 * Session filter for Documents library:
 * - matching session id
 * - unscoped / legacy rows (missing session) → visible in every session so uploads are not “lost”
 */
export function documentBelongsToSessionView(
  docRow: ProcessedDocument | Record<string, unknown>,
  sessionId: string,
): boolean {
  const docSid =
    resolveDocumentSessionId(docRow as Record<string, unknown>) ||
    (typeof (docRow as ProcessedDocument).session_id === 'string'
      ? (docRow as ProcessedDocument).session_id!
      : '');
  if (!docSid) return true;
  return docSid === sessionId;
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
  const { dataOwnerUid } = useWorkspace();
  const canWrite = useDataWriteAccess();
  const { currentSession, isAllSessionsView, sessions } = useSession();
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restaurantDocsRef = useRef<ProcessedDocument[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const sessionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionIds.current = new Set(sessions.map((s) => s.id));
  }, [sessions]);

  const applyDocs = useCallback(
    (raw: ProcessedDocument[]) => {
      restaurantDocsRef.current = raw;
      let filtered = raw;
      if (!isAllSessionsView && currentSession) {
        const sid = currentSession.id;
        const knownSessions = sessionIds.current;
        filtered = raw.filter((d) => {
          if (documentBelongsToSessionView(d, sid)) return true;
          // Orphaned: session was deleted — still show under the active session so files are recoverable
          const docSid = resolveDocumentSessionId(d as unknown as Record<string, unknown>);
          return Boolean(docSid) && knownSessions.size > 0 && !knownSessions.has(docSid);
        });
      }

      const { keepers, duplicateIds } = dedupeProcessedDocuments(filtered);
      keepers.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

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
    },
    [canWrite, currentSession, dataOwnerUid, isAllSessionsView],
  );

  const subscribeDocuments = useCallback(() => {
    const uid = dataOwnerUid;
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!uid || !db) {
      setDocuments([]);
      restaurantDocsRef.current = [];
      setLoading(false);
      return;
    }

    if (!isAllSessionsView && !currentSession) {
      setDocuments([]);
      restaurantDocsRef.current = [];
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docsRef = collection(db, 'documents');
    // Do NOT orderBy created_at — Firestore omits docs missing that field, which hid tickets/PDFs.
    // Sort client-side after mapping (supports created_at + createdAt).
    const qPrimary = query(docsRef, where('restaurantId', '==', uid));
    const qLegacy = query(docsRef, where('restaurant_id', '==', uid));

    let usingLegacy = false;

    const handleSnap = (snapshot: QuerySnapshot<DocumentData>) => {
      const mapped = mapSnapshotDocs(snapshot);
      applyDocs(mapped);
      setLoading(false);
    };

    const handleErr = (err: Error) => {
      if (!usingLegacy) {
        usingLegacy = true;
        console.warn('Documents restaurantId listen failed, trying restaurant_id:', err);
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        unsubRef.current = onSnapshot(qLegacy, handleSnap, (err2) => {
          console.error('Error listening to documents:', err2);
          setError(err2.message || String(err2));
          setDocuments([]);
          setLoading(false);
        });
        return;
      }
      console.error('Error listening to documents:', err);
      setError(err.message || String(err));
      setDocuments([]);
      setLoading(false);
    };

    unsubRef.current = onSnapshot(qPrimary, handleSnap, handleErr);
  }, [applyDocs, currentSession, dataOwnerUid, isAllSessionsView]);

  useEffect(() => {
    subscribeDocuments();
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [subscribeDocuments]);

  // Re-filter cached restaurant docs when session list finishes loading (orphan recovery).
  useEffect(() => {
    if (restaurantDocsRef.current.length === 0) return;
    applyDocs(restaurantDocsRef.current);
  }, [applyDocs, sessions]);

  const addDocument = useCallback(
    async (document: ProcessedDocument): Promise<ProcessedDocument> => {
      const uid = dataOwnerUid;
      const sessionId = currentSession?.id;

      if (!uid || !canWrite || !sessionId || !db) {
        throw new Error('User or session not found');
      }

      try {
        const { id: _clientId, ...documentFields } = document;
        const stampedSession =
          (typeof document.session_id === 'string' && document.session_id) ||
          (typeof (document as { sessionId?: string }).sessionId === 'string' &&
            (document as { sessionId?: string }).sessionId) ||
          sessionId;
        const rawDocData = {
          ...documentFields,
          restaurantId: uid,
          restaurant_id: uid,
          userId: uid,
          uid,
          session_id: stampedSession,
          sessionId: stampedSession,
          created_at: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

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
          session_id: stampedSession,
          sessionId: stampedSession,
        }) as ProcessedDocument;
        const newDoc = { ...localFields, id: firestoreId, persistedDocumentId: firestoreId };
        setDocuments((prev) => {
          if (prev.some((d) => d.id === firestoreId)) return prev;
          return [newDoc, ...prev];
        });
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

        // Keep session stamps dual-written when we know the session
        const sid =
          resolveDocumentSessionId(updates as Record<string, unknown>) ||
          resolveDocumentSessionId(existing as unknown as Record<string, unknown>) ||
          currentSession?.id ||
          '';
        if (sid) {
          if (cleanedUpdates.session_id == null) cleanedUpdates.session_id = sid;
          if (cleanedUpdates.sessionId == null) cleanedUpdates.sessionId = sid;
        }

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
          prev.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  ...packed.forLocal,
                  ...(sid ? { session_id: sid, sessionId: sid } : {}),
                }
              : d
          )
        );
      } catch (err) {
        console.error('Error updating document:', err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [canWrite, currentSession?.id, dataOwnerUid, documents]
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
    refreshDocuments: async () => {
      subscribeDocuments();
    },
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentProvider');
  return ctx;
}
