import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useWorkspace } from './WorkspaceContext';
import { useSession } from './SessionContext';
import type {
  InventoryProduct,
  InventoryMovement,
  InventoryProductSummary,
  InventoryPosRecipe,
} from '../types/inventory';
import { computeFifo, type FifoMovement } from '@shared/inventoryFifo';

function rowSessionId(data: { sessionId?: string; session_id?: string } | null | undefined): string {
  return String(data?.sessionId || data?.session_id || '').trim();
}

function belongsToSession(
  data: { sessionId?: string; session_id?: string } | null | undefined,
  sessionId: string,
): boolean {
  const sid = rowSessionId(data);
  // Legacy rows without sessionId are hidden from every session.
  return Boolean(sid) && sid === sessionId;
}

/** Firestore rejects `undefined` field values — omit them from writes. */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

interface InventoryContextValue {
  products: InventoryProductSummary[];
  movements: InventoryMovement[];
  recipes: InventoryPosRecipe[];
  loading: boolean;
  addProduct: (
    p: Omit<
      InventoryProduct,
      | 'id'
      | 'restaurantId'
      | 'sessionId'
      | 'onHandQty'
      | 'valuationAmount'
      | 'avgUnitCost'
      | 'createdAt'
      | 'updatedAt'
    >,
  ) => Promise<string>;
  updateProduct: (id: string, updates: Partial<InventoryProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addMovement: (
    m: Omit<InventoryMovement, 'id' | 'restaurantId' | 'sessionId' | 'createdAt'>,
  ) => Promise<string>;
  addMovementsBatch: (
    ms: Omit<InventoryMovement, 'id' | 'restaurantId' | 'sessionId' | 'createdAt'>[],
  ) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  deleteMovementsByInvoice: (invoiceId: string) => Promise<number>;
  deleteMovementsByDocument: (documentId: string) => Promise<number>;
  addRecipe: (
    r: Omit<InventoryPosRecipe, 'id' | 'restaurantId' | 'sessionId' | 'createdAt' | 'updatedAt'>,
  ) => Promise<string>;
  updateRecipe: (
    id: string,
    updates: Partial<Pick<InventoryPosRecipe, 'posName' | 'productId' | 'qtyPerUnit'>>,
  ) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  totalValuation: number;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { dataOwnerUid } = useWorkspace();
  const { currentSession } = useSession();
  const sessionId = currentSession?.id ?? null;
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [recipes, setRecipes] = useState<InventoryPosRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !dataOwnerUid || !sessionId) {
      setProducts([]);
      setMovements([]);
      setRecipes([]);
      setLoading(false);
      return;
    }

    let loadCount = 0;
    const checkDone = () => {
      loadCount++;
      if (loadCount >= 3) setLoading(false);
    };
    setLoading(true);
    loadCount = 0;

    const onPermError = (err: unknown) => {
      const code = (err as { code?: string })?.code || '';
      if (code === 'permission-denied') {
        console.error(
          '[inventory] Firestore permission-denied — deploy firestore.rules for inventory_* collections',
          err,
        );
      }
      checkDone();
    };

    // Prefer restaurantId + sessionId; fall back to restaurantId-only + client filter
    // when the composite index is not yet deployed.
    const subscribeCollection = <T extends InventoryProduct | InventoryMovement | InventoryPosRecipe>(
      collectionName: string,
      setRows: (rows: T[]) => void,
      sortFn: (a: T, b: T) => number,
    ) => {
      const restaurantQ = query(
        collection(db!, collectionName),
        where('restaurantId', '==', dataOwnerUid),
      );

      // Client-filter by sessionId so legacy unscoped rows stay hidden and
      // missing composite indexes do not break the tab.
      return onSnapshot(
        restaurantQ,
        (snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as T))
            .filter((row) => belongsToSession(row as { sessionId?: string }, sessionId));
          rows.sort(sortFn);
          setRows(rows);
          checkDone();
        },
        onPermError,
      );
    };

    const unsub1 = subscribeCollection<InventoryProduct>(
      'inventory_products',
      setProducts,
      (a, b) => a.name.localeCompare(b.name),
    );
    const unsub2 = subscribeCollection<InventoryMovement>(
      'inventory_movements',
      setMovements,
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
    const unsub3 = subscribeCollection<InventoryPosRecipe>(
      'inventory_pos_recipes',
      setRecipes,
      (a, b) => a.posName.localeCompare(b.posName),
    );

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [dataOwnerUid, sessionId]);

  const productSummaries = useMemo((): InventoryProductSummary[] => {
    const movsByProduct = new Map<string, InventoryMovement[]>();
    for (const m of movements) {
      const arr = movsByProduct.get(m.productId) || [];
      arr.push(m);
      movsByProduct.set(m.productId, arr);
    }

    return products.map((p) => {
      const pMovs = movsByProduct.get(p.id) || [];
      const fifoInput: FifoMovement[] = pMovs.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        unitCost: m.unitCost,
        date: m.date,
      }));
      const fifo = computeFifo(fifoInput);
      const totalIn = pMovs
        .filter((m) => m.type === 'stock_in' || m.type === 'stock_restore')
        .reduce((s, m) => s + m.quantity, 0);
      const totalOut = pMovs
        .filter((m) => m.type === 'stock_out')
        .reduce((s, m) => s + m.quantity, 0);

      return {
        ...p,
        onHandQty: fifo.onHandQty,
        valuationAmount: fifo.valuationAmount,
        avgUnitCost: fifo.avgUnitCost,
        totalIn,
        totalOut,
      };
    });
  }, [products, movements]);

  const totalValuation = useMemo(
    () => productSummaries.reduce((s, p) => s + p.valuationAmount, 0),
    [productSummaries],
  );

  const requireSession = useCallback(() => {
    if (!db || !dataOwnerUid) throw new Error('Not authenticated');
    if (!sessionId) throw new Error('No active session — create or select a session first');
    return { sessionId, dataOwnerUid };
  }, [dataOwnerUid, sessionId]);

  const addProduct = useCallback(
    async (
      p: Omit<
        InventoryProduct,
        | 'id'
        | 'restaurantId'
        | 'sessionId'
        | 'onHandQty'
        | 'valuationAmount'
        | 'avgUnitCost'
        | 'createdAt'
        | 'updatedAt'
      >,
    ) => {
      const { sessionId: sid, dataOwnerUid: uid } = requireSession();
      const now = new Date().toISOString();
      const ref = await addDoc(
        collection(db!, 'inventory_products'),
        omitUndefined({
          ...p,
          restaurantId: uid,
          sessionId: sid,
          onHandQty: 0,
          valuationAmount: 0,
          avgUnitCost: 0,
          createdAt: now,
          updatedAt: now,
        }),
      );
      return ref.id;
    },
    [requireSession],
  );

  const updateProduct = useCallback(async (id: string, updates: Partial<InventoryProduct>) => {
    if (!db) return;
    const { id: _id, restaurantId: _r, sessionId: _s, ...safe } = updates as InventoryProduct;
    await updateDoc(
      doc(db, 'inventory_products', id),
      omitUndefined({
        ...safe,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, []);

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!db) return;
      const related = movements.filter((m) => m.productId === id);
      const relatedRecipes = recipes.filter((r) => r.productId === id);
      const batch = writeBatch(db);
      for (const m of related) {
        batch.delete(doc(db, 'inventory_movements', m.id));
      }
      for (const r of relatedRecipes) {
        batch.delete(doc(db, 'inventory_pos_recipes', r.id));
      }
      batch.delete(doc(db, 'inventory_products', id));
      await batch.commit();
    },
    [movements, recipes],
  );

  const addMovement = useCallback(
    async (m: Omit<InventoryMovement, 'id' | 'restaurantId' | 'sessionId' | 'createdAt'>) => {
      const { sessionId: sid, dataOwnerUid: uid } = requireSession();
      const ref = await addDoc(
        collection(db!, 'inventory_movements'),
        omitUndefined({
          ...m,
          restaurantId: uid,
          sessionId: sid,
          createdAt: new Date().toISOString(),
        }),
      );
      return ref.id;
    },
    [requireSession],
  );

  const addMovementsBatch = useCallback(
    async (ms: Omit<InventoryMovement, 'id' | 'restaurantId' | 'sessionId' | 'createdAt'>[]) => {
      if (ms.length === 0) return;
      const { sessionId: sid, dataOwnerUid: uid } = requireSession();
      const batch = writeBatch(db!);
      const now = new Date().toISOString();
      for (const m of ms) {
        const ref = doc(collection(db!, 'inventory_movements'));
        batch.set(
          ref,
          omitUndefined({
            ...m,
            restaurantId: uid,
            sessionId: sid,
            createdAt: now,
          }),
        );
      }
      await batch.commit();
    },
    [requireSession],
  );

  const deleteMovement = useCallback(async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'inventory_movements', id));
  }, []);

  const deleteMovementsByInvoice = useCallback(
    async (invoiceId: string) => {
      if (!db) return 0;
      const toDelete = movements.filter((m) => m.invoiceId === invoiceId);
      if (toDelete.length === 0) return 0;
      const batch = writeBatch(db);
      for (const m of toDelete) {
        batch.delete(doc(db, 'inventory_movements', m.id));
      }
      await batch.commit();
      return toDelete.length;
    },
    [movements],
  );

  const deleteMovementsByDocument = useCallback(
    async (documentId: string) => {
      if (!db) return 0;
      const toDelete = movements.filter((m) => m.documentId === documentId);
      if (toDelete.length === 0) return 0;
      const batch = writeBatch(db);
      for (const m of toDelete) {
        batch.delete(doc(db, 'inventory_movements', m.id));
      }
      await batch.commit();
      return toDelete.length;
    },
    [movements],
  );

  const addRecipe = useCallback(
    async (
      r: Omit<InventoryPosRecipe, 'id' | 'restaurantId' | 'sessionId' | 'createdAt' | 'updatedAt'>,
    ) => {
      const { sessionId: sid, dataOwnerUid: uid } = requireSession();
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db!, 'inventory_pos_recipes'), {
        posName: r.posName.trim(),
        productId: r.productId,
        qtyPerUnit: r.qtyPerUnit > 0 ? r.qtyPerUnit : 1,
        restaurantId: uid,
        sessionId: sid,
        createdAt: now,
        updatedAt: now,
      });
      return ref.id;
    },
    [requireSession],
  );

  const updateRecipe = useCallback(
    async (
      id: string,
      updates: Partial<Pick<InventoryPosRecipe, 'posName' | 'productId' | 'qtyPerUnit'>>,
    ) => {
      if (!db) return;
      const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.posName != null) payload.posName = updates.posName.trim();
      if (updates.productId != null) payload.productId = updates.productId;
      if (updates.qtyPerUnit != null) payload.qtyPerUnit = updates.qtyPerUnit > 0 ? updates.qtyPerUnit : 1;
      await updateDoc(doc(db, 'inventory_pos_recipes', id), payload as Record<string, string | number>);
    },
    [],
  );

  const deleteRecipe = useCallback(async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'inventory_pos_recipes', id));
  }, []);

  return (
    <InventoryContext.Provider
      value={{
        products: productSummaries,
        movements,
        recipes,
        loading,
        addProduct,
        updateProduct,
        deleteProduct,
        addMovement,
        addMovementsBatch,
        deleteMovement,
        deleteMovementsByInvoice,
        deleteMovementsByDocument,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        totalValuation,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be inside InventoryProvider');
  return ctx;
}

export function useInventoryOptional() {
  return useContext(InventoryContext);
}
