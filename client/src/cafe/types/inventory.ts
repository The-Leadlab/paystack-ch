/**
 * Inventory / stock management types.
 *
 * Firestore collections:
 *   inventory_products/{id}  — product catalog
 *   inventory_movements/{id} — stock-in / stock-out records (immutable log)
 */

export type UnitOfMeasure = 'pcs' | 'kg' | 'g' | 'l' | 'ml' | 'box' | 'pack' | 'other';

export interface ProductCategory {
  id: string;
  name: string;
  subcategories?: string[];
}

/** Business-type specific category presets. */
export const PRODUCT_CATEGORY_PRESETS: Record<string, ProductCategory[]> = {
  garage: [
    { id: 'parts', name: 'Parts', subcategories: ['Engine', 'Brakes', 'Suspension', 'Electrical'] },
    { id: 'tyres', name: 'Tyres', subcategories: ['Summer', 'Winter', 'All-season'] },
    { id: 'fluids', name: 'Fluids & Oils' },
    { id: 'accessories', name: 'Accessories' },
  ],
  restaurant: [
    { id: 'food', name: 'Food', subcategories: ['Meat', 'Fish', 'Dairy', 'Vegetables', 'Dry goods'] },
    {
      id: 'beverages',
      name: 'Beverages',
      subcategories: ['Soft drinks', 'Wine', 'Beer', 'Spirits', 'Coffee & tea'],
    },
    { id: 'supplies', name: 'Supplies', subcategories: ['Cleaning', 'Packaging', 'Disposables'] },
  ],
  retail: [
    { id: 'merchandise', name: 'Merchandise' },
    { id: 'packaging', name: 'Packaging' },
  ],
  general: [
    { id: 'goods', name: 'Goods' },
    { id: 'materials', name: 'Materials' },
    { id: 'consumables', name: 'Consumables' },
  ],
};

/** One-click café / kitchen starter catalog (Phase 1 empty-state seed). */
export const RESTAURANT_CAFE_SEED_PRODUCTS: Array<{
  name: string;
  sku: string;
  unit: UnitOfMeasure;
  category: string;
  subcategory?: string;
  minStockLevel: number;
  /** Opening qty for first stock_in (FIFO layer). */
  initialQty: number;
  /** Opening unit cost in reporting currency (CHF/GBP), not cents. */
  initialUnitCost: number;
}> = [
  {
    name: 'Coffee beans',
    sku: 'COF-BEANS',
    unit: 'kg',
    category: 'Beverages',
    subcategory: 'Coffee & tea',
    minStockLevel: 2,
    initialQty: 5,
    initialUnitCost: 28,
  },
  {
    name: 'Whole milk',
    sku: 'DAI-MILK',
    unit: 'l',
    category: 'Food',
    subcategory: 'Dairy',
    minStockLevel: 5,
    initialQty: 20,
    initialUnitCost: 1.6,
  },
  {
    name: 'Soft drinks (cans)',
    sku: 'BEV-SOFT',
    unit: 'pcs',
    category: 'Beverages',
    subcategory: 'Soft drinks',
    minStockLevel: 24,
    initialQty: 48,
    initialUnitCost: 0.85,
  },
  {
    name: 'Cooking oil',
    sku: 'FOOD-OIL',
    unit: 'l',
    category: 'Food',
    subcategory: 'Dry goods',
    minStockLevel: 2,
    initialQty: 10,
    initialUnitCost: 4.5,
  },
  {
    name: 'Napkins / packaging',
    sku: 'SUP-PACK',
    unit: 'pack',
    category: 'Supplies',
    subcategory: 'Packaging',
    minStockLevel: 5,
    initialQty: 12,
    initialUnitCost: 8,
  },
];

export interface InventoryProduct {
  id: string;
  restaurantId: string;
  sku?: string;
  name: string;
  description?: string;
  unit: UnitOfMeasure;
  category?: string;
  subcategory?: string;
  /** Current on-hand quantity (denormalised from movements for fast reads). */
  onHandQty: number;
  /** Minimum stock level for alerts (optional). */
  minStockLevel?: number;
  /** Current FIFO valuation in reporting currency (CHF or GBP). */
  valuationAmount: number;
  /** Weighted-average unit cost (fallback when FIFO layers aren't needed). */
  avgUnitCost: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export type MovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'stock_restore';

export interface InventoryMovement {
  id: string;
  restaurantId: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  /** Per-unit cost at time of movement (stock_in only). */
  unitCost?: number;
  /** Total cost of this movement line. */
  totalCost?: number;
  /** Reference to a sales invoice id (stock_out from invoice). */
  invoiceId?: string;
  /** Reference to a supplier or POS document id (stock_in / POS stock_out). */
  documentId?: string;
  note?: string;
  date: string;
  createdAt: string;
}

/** POS sold-item → inventory product recipe (Phase 2). */
export interface InventoryPosRecipe {
  id: string;
  restaurantId: string;
  /** Text as printed on the till / ticket (e.g. "Espresso"). */
  posName: string;
  productId: string;
  /** Inventory units consumed per 1 sold unit. */
  qtyPerUnit: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * FIFO cost layer: each stock-in creates a layer; stock-out consumes
 * from the oldest layer first.
 */
export interface FifoCostLayer {
  movementId: string;
  date: string;
  originalQty: number;
  remainingQty: number;
  unitCost: number;
}

/** Summary row for the inventory list view. */
export interface InventoryProductSummary extends InventoryProduct {
  totalIn: number;
  totalOut: number;
}
