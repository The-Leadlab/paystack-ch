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
import type {
  InventoryProduct,
  InventoryMovement,
  InventoryProductSummary,
  InventoryPosRecipe,
} from '../types/inventory';
import { computeFifo, type FifoMovement } from '@shared/inventoryFifo';

interface InventoryContextValue {
  products: InventoryProductSummary[];
  movements: InventoryMovement[];
  recipes: InventoryPosRecipe[];
  loading: boolean;
  addProduct: (p: Omit<InventoryProduct, 'id' | 'restaurantId' | 'onHandQty' | 'valuationAmount' | 'avgUnitCost' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<InventoryProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addMovement: (m: Omit<InventoryMovement, 'id' | 'restaurantId' | 'createdAt'>) => Promise<string>;
  addMovementsBatch: (ms: Omit<InventoryMovement, 'id' | 'restaurantId' | 'createdAt'>[]) => Promise<void>;
  deleteMovementsByInvoice: (invoiceId: string) => Promise<number>;
  deleteMovementsByDocument: (documentId: string) => Promise<number>;
  addRecipe: (r: Omit<InventoryPosRecipe, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateRecipe: (id: string, updates: Partial<Pick<InventoryPosRecipe, 'posName' | 'productId' | 'qtyPerUnit'>>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  totalValuation: number;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { dataOwnerUid } = useWorkspace();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [recipes, setRecipes] = useState<InventoryPosRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !dataOwnerUid) {
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

    const pQ = query(
      collection(db, 'inventory_products'),
      where('restaurantId', '==', dataOwnerUid),
    );
    const unsub1 = onSnapshot(
      pQ,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryProduct));
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(rows);
        checkDone();
      },
      () => checkDone(),
    );

    const mQ = query(
      collection(db, 'inventory_movements'),
      where('restaurantId', '==', dataOwnerUid),
    );
    const unsub2 = onSnapshot(
      mQ,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryMovement));
        rows.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
        setMovements(rows);
        checkDone();
      },
      () => checkDone(),
    );

    const rQ = query(
      collection(db, 'inventory_pos_recipes'),
      where('restaurantId', '==', dataOwnerUid),
    );
    const unsub3 = onSnapshot(
      rQ,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryPosRecipe));
        rows.sort((a, b) => a.posName.localeCompare(b.posName));
        setRecipes(rows);
        checkDone();
      },
      () => checkDone(),
    );

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [dataOwnerUid]);

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

  const addProduct = useCallback(
    async (
      p: Omit<
        InventoryProduct,
        'id' | 'restaurantId' | 'onHandQty' | 'valuationAmount' | 'avgUnitCost' | 'createdAt' | 'updatedAt'
      >,
    ) => {
      if (!db || !dataOwnerUid) throw new Error('Not authenticated');
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, 'inventory_products'), {
        ...p,
        restaurantId: dataOwnerUid,
        onHandQty: 0,
        valuationAmount: 0,
        avgUnitCost: 0,
        createdAt: now,
        updatedAt: now,
      });
      return ref.id;
    },
    [dataOwnerUid],
  );

  const updateProduct = useCallback(async (id: string, updates: Partial<InventoryProduct>) => {
    if (!db) return;
    await updateDoc(doc(db, 'inventory_products', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
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
    async (m: Omit<InventoryMovement, 'id' | 'restaurantId' | 'createdAt'>) => {
      if (!db || !dataOwnerUid) throw new Error('Not authenticated');
      const ref = await addDoc(collection(db, 'inventory_movements'), {
        ...m,
        restaurantId: dataOwnerUid,
        createdAt: new Date().toISOString(),
      });
      return ref.id;
    },
    [dataOwnerUid],
  );

  const addMovementsBatch = useCallback(
    async (ms: Omit<InventoryMovement, 'id' | 'restaurantId' | 'createdAt'>[]) => {
      if (!db || !dataOwnerUid || ms.length === 0) return;
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      for (const m of ms) {
        const ref = doc(collection(db, 'inventory_movements'));
        batch.set(ref, { ...m, restaurantId: dataOwnerUid, createdAt: now });
      }
      await batch.commit();
    },
    [dataOwnerUid],
  );

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
    async (r: Omit<InventoryPosRecipe, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>) => {
      if (!db || !dataOwnerUid) throw new Error('Not authenticated');
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, 'inventory_pos_recipes'), {
        posName: r.posName.trim(),
        productId: r.productId,
        qtyPerUnit: r.qtyPerUnit > 0 ? r.qtyPerUnit : 1,
        restaurantId: dataOwnerUid,
        createdAt: now,
        updatedAt: now,
      });
      return ref.id;
    },
    [dataOwnerUid],
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
      await updateDoc(doc(db, 'inventory_pos_recipes', id), payload);
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
