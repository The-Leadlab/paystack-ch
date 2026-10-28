/**
 * Load inventory products + movements for a restaurant owner and build a report snapshot.
 * Used by email/cron financial reports so stock matches the client export.
 */
import { getFirestore } from "firebase-admin/firestore";
import {
  buildSessionInventorySnapshot,
  type SessionInventorySnapshot,
  type SnapshotMovement,
  type SnapshotProduct,
} from "../shared/inventoryReportSnapshot.js";

async function loadCollectionByOwner(
  collectionName: string,
  uid: string
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const db = getFirestore();
  const [byCamel, bySnake] = await Promise.all([
    db.collection(collectionName).where("restaurantId", "==", uid).get(),
    db.collection(collectionName).where("restaurant_id", "==", uid).get(),
  ]);
  const map = new Map<string, Record<string, unknown> & { id: string }>();
  for (const snap of [byCamel, bySnake]) {
    for (const doc of snap.docs) {
      map.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) });
    }
  }
  return [...map.values()];
}

export async function loadInventorySnapshotForReport(opts: {
  uid: string;
  dateFrom?: string;
  dateTo?: string;
  revenueAmount?: number;
}): Promise<SessionInventorySnapshot | null> {
  const [rawProducts, rawMovements] = await Promise.all([
    loadCollectionByOwner("inventory_products", opts.uid),
    loadCollectionByOwner("inventory_movements", opts.uid),
  ]);

  if (rawProducts.length === 0 && rawMovements.length === 0) return null;

  const products: SnapshotProduct[] = rawProducts.map((p) => ({
    id: p.id,
    name: String(p.name || ""),
    sku: p.sku != null ? String(p.sku) : undefined,
    unit: p.unit != null ? String(p.unit) : "pcs",
    category: p.category != null ? String(p.category) : undefined,
    archived: Boolean(p.archived),
    onHandQty: Number(p.onHandQty) || 0,
    valuationAmount: Number(p.valuationAmount) || 0,
  }));

  const movements: SnapshotMovement[] = rawMovements.map((m) => ({
    id: m.id,
    productId: String(m.productId || ""),
    productName: m.productName != null ? String(m.productName) : undefined,
    type: String(m.type || "stock_in") as SnapshotMovement["type"],
    quantity: Number(m.quantity) || 0,
    unitCost: m.unitCost != null ? Number(m.unitCost) : undefined,
    date: String(m.date || "").slice(0, 10),
    documentId: m.documentId != null ? String(m.documentId) : undefined,
  }));

  return buildSessionInventorySnapshot({
    products,
    movements,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    revenueAmount: opts.revenueAmount,
  });
}

export function snapshotToReportFields(snap: SessionInventorySnapshot | null) {
  if (!snap) return {};
  return {
    inventoryValuation: snap.valuation,
    inventoryCogs: snap.periodCogs,
    inventoryFoodCostPercent: snap.foodCostPercent ?? undefined,
    inventoryProducts: snap.productRows,
    inventoryMovements: snap.movementRows,
  };
}
