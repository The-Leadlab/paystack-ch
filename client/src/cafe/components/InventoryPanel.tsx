import React, { useState, useMemo, useCallback } from 'react';
import {
  Package,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Construction,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useLanguage } from '../context/LanguageContext';
import { useUkUat } from '../context/UkUatContext';
import type {
  InventoryProductSummary,
  UnitOfMeasure,
  MovementType,
} from '../types/inventory';
import { PRODUCT_CATEGORY_PRESETS } from '../types/inventory';

const UNIT_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'g', label: 'Grams' },
  { value: 'l', label: 'Litres' },
  { value: 'ml', label: 'Millilitres' },
  { value: 'box', label: 'Boxes' },
  { value: 'pack', label: 'Packs' },
  { value: 'other', label: 'Other' },
];

function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Construction className="w-3 h-3" />
      {label}
    </span>
  );
}

export function InventoryPanel() {
  const { products, movements, loading, addProduct, updateProduct, deleteProduct, addMovement, totalValuation } = useInventory();
  const { t } = useLanguage();
  const { fiscalLocale, currencySuffix } = useUkUat();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddMovement, setShowAddMovement] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<InventoryProductSummary | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [businessType, setBusinessType] = useState<string>('general');

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => !p.archived);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)),
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category === categoryFilter);
    }
    return result;
  }, [products, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of products) {
      if (p.category) cats.add(p.category);
    }
    return Array.from(cats).sort();
  }, [products]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.minStockLevel != null && p.onHandQty <= p.minStockLevel && !p.archived),
    [products],
  );

  const fmtMoney = useCallback(
    (cents: number) => {
      const n = new Intl.NumberFormat(fiscalLocale === 'uk' ? 'en-GB' : 'de-CH', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return n.format(cents / 100) + ' ' + currencySuffix.trim();
    },
    [fiscalLocale, currencySuffix],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-cdlp-muted">
        <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-2" />
        {t('invLoading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-cdlp-white flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t('inventoryTab')}
          </h2>
          <p className="text-sm text-cdlp-muted mt-0.5">
            {t('invPanelSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-3">
            <div className="text-xs text-cdlp-muted">{t('invTotalStockValue')}</div>
            <div className="text-sm font-semibold text-cdlp-white">{fmtMoney(totalValuation)}</div>
          </div>
          <button
            type="button"
            onClick={() => { setShowAddProduct(true); setEditProduct(null); }}
            className="ba-btn ba-btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> {t('invAddProduct')}
          </button>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            {t('invLowStockAlert').replace('{n}', String(lowStockProducts.length))}
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((p) => (
              <span key={p.id} className="text-xs text-amber-300 bg-amber-500/10 rounded px-2 py-0.5">
                {p.name}: {p.onHandQty} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cdlp-muted" />
          <input
            type="text"
            placeholder={t('invSearchProducts')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-cdlp-card border border-cdlp-border rounded text-sm text-cdlp-white placeholder:text-cdlp-muted focus:outline-none focus:ring-1 focus:ring-cdlp-accent"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-cdlp-card border border-cdlp-border rounded px-2 py-1.5 text-sm text-cdlp-white focus:outline-none focus:ring-1 focus:ring-cdlp-accent"
          >
            <option value="all">{t('invAllCategories')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Product table */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-cdlp-muted">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{products.length === 0 ? t('invNoProductsYet') : t('invNoProductsMatch')}</p>
        </div>
      ) : (
        <div className="border border-cdlp-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cdlp-border bg-cdlp-card/50">
                <th className="text-left px-3 py-2 text-cdlp-muted font-medium">{t('invColProduct')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium hidden sm:table-cell">{t('invColCategory')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium">{t('invColQtyIn')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium">{t('invColQtyOut')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium">{t('invColOnHand')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium hidden sm:table-cell">{t('invColUnitCost')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium">{t('invColValue')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium w-24">{t('invColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <React.Fragment key={p.id}>
                  <tr
                    className="border-b border-cdlp-border/50 hover:bg-cdlp-card/30 cursor-pointer"
                    onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {expandedProduct === p.id ? (
                          <ChevronUp className="w-3.5 h-3.5 text-cdlp-muted shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-cdlp-muted shrink-0" />
                        )}
                        <div>
                          <span className="text-cdlp-white font-medium">{p.name}</span>
                          {p.sku && <span className="text-cdlp-muted text-xs ml-1.5">({p.sku})</span>}
                          {p.minStockLevel != null && p.onHandQty <= p.minStockLevel && (
                            <AlertTriangle className="w-3 h-3 text-amber-400 inline ml-1" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-3 py-2 text-cdlp-muted hidden sm:table-cell">{p.category || '—'}</td>
                    <td className="text-right px-3 py-2 text-green-400">{p.totalIn}</td>
                    <td className="text-right px-3 py-2 text-red-400">{p.totalOut}</td>
                    <td className="text-right px-3 py-2 text-cdlp-white font-semibold">
                      {p.onHandQty} <span className="text-cdlp-muted text-xs">{p.unit}</span>
                    </td>
                    <td className="text-right px-3 py-2 text-cdlp-muted hidden sm:table-cell">{fmtMoney(Math.round(p.avgUnitCost))}</td>
                    <td className="text-right px-3 py-2 text-cdlp-white">{fmtMoney(Math.round(p.valuationAmount))}</td>
                    <td className="text-right px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={t('invAddMovement')}
                          onClick={(e) => { e.stopPropagation(); setShowAddMovement(p.id); }}
                          className="p-1 rounded hover:bg-cdlp-card text-cdlp-muted hover:text-green-400 transition-colors"
                        >
                          <ArrowUpCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title={t('invEditProduct')}
                          onClick={(e) => { e.stopPropagation(); setEditProduct(p); setShowAddProduct(true); }}
                          className="p-1 rounded hover:bg-cdlp-card text-cdlp-muted hover:text-cdlp-white transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title={t('invDeleteProduct')}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t('invDeleteProductConfirm').replace('{name}', p.name))) {
                              void deleteProduct(p.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-cdlp-card text-cdlp-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedProduct === p.id && (
                    <tr>
                      <td colSpan={8} className="bg-cdlp-card/20 px-4 py-3">
                        <ProductMovementHistory
                          productId={p.id}
                          movements={movements}
                          fmtMoney={fmtMoney}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-cdlp-border bg-cdlp-card/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-cdlp-white">{t('invComingSoonPos')}</h3>
            <ComingSoonBadge label={t('comingSoon')} />
          </div>
          <p className="text-xs text-cdlp-muted">
            {t('invComingSoonPosHint')}
          </p>
        </div>
        <div className="rounded-lg border border-cdlp-border bg-cdlp-card/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-cdlp-white">{t('invComingSoonBarcode')}</h3>
            <ComingSoonBadge label={t('comingSoon')} />
          </div>
          <p className="text-xs text-cdlp-muted">
            {t('invComingSoonBarcodeHint')}
          </p>
        </div>
      </div>

      {/* Add/Edit Product Dialog */}
      {showAddProduct && (
        <ProductFormDialog
          product={editProduct}
          businessType={businessType}
          onBusinessTypeChange={setBusinessType}
          onSave={async (data) => {
            if (editProduct) {
              await updateProduct(editProduct.id, data);
            } else {
              await addProduct(data);
            }
            setShowAddProduct(false);
            setEditProduct(null);
          }}
          onClose={() => { setShowAddProduct(false); setEditProduct(null); }}
        />
      )}

      {/* Add Movement Dialog */}
      {showAddMovement && (
        <MovementFormDialog
          productId={showAddMovement}
          productName={products.find((p) => p.id === showAddMovement)?.name || ''}
          onSave={async (data) => {
            await addMovement(data);
            setShowAddMovement(null);
          }}
          onClose={() => setShowAddMovement(null)}
        />
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function ProductMovementHistory({
  productId,
  movements,
  fmtMoney,
}: {
  productId: string;
  movements: { id: string; productId: string; type: MovementType; quantity: number; unitCost?: number; totalCost?: number; date: string; note?: string; invoiceId?: string; documentId?: string }[];
  fmtMoney: (cents: number) => string;
}) {
  const { t } = useLanguage();
  const pMovs = movements.filter((m) => m.productId === productId).sort((a, b) => b.date.localeCompare(a.date));
  if (pMovs.length === 0) {
    return <p className="text-xs text-cdlp-muted italic">{t('invNoMovements')}</p>;
  }
  const typeLabel =
    (type: MovementType) =>
      type === 'stock_in' ? t('invTypeIn') : type === 'stock_out' ? t('invTypeOut') : type === 'stock_restore' ? t('invTypeRestore') : t('invTypeAdjust');
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      <div className="text-xs font-medium text-cdlp-muted mb-1">{t('invMovementHistory')}</div>
      {pMovs.map((m) => (
        <div key={m.id} className="flex items-center gap-3 text-xs">
          <span className="text-cdlp-muted w-20 shrink-0">{m.date}</span>
          <span className={`w-20 shrink-0 font-medium ${m.type === 'stock_in' || m.type === 'stock_restore' ? 'text-green-400' : m.type === 'stock_out' ? 'text-red-400' : 'text-yellow-400'}`}>
            {typeLabel(m.type)} {m.quantity}
          </span>
          {m.unitCost != null && <span className="text-cdlp-muted">@ {fmtMoney(Math.round(m.unitCost))}</span>}
          {m.note && <span className="text-cdlp-muted truncate">{m.note}</span>}
          {m.invoiceId && <span className="text-blue-400 text-[10px]">Invoice</span>}
          {m.documentId && <span className="text-blue-400 text-[10px]">Document</span>}
        </div>
      ))}
    </div>
  );
}

function ProductFormDialog({
  product,
  businessType,
  onBusinessTypeChange,
  onSave,
  onClose,
}: {
  product: InventoryProductSummary | null;
  businessType: string;
  onBusinessTypeChange: (t: string) => void;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [unit, setUnit] = useState<UnitOfMeasure>(product?.unit || 'pcs');
  const [category, setCategory] = useState(product?.category || '');
  const [subcategory, setSubcategory] = useState(product?.subcategory || '');
  const [description, setDescription] = useState(product?.description || '');
  const [minStockLevel, setMinStockLevel] = useState(product?.minStockLevel?.toString() || '');
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();

  const presets = PRODUCT_CATEGORY_PRESETS[businessType] || PRODUCT_CATEGORY_PRESETS.general;
  const selectedPreset = presets.find((p) => p.name === category);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit,
        category: category || undefined,
        subcategory: subcategory || undefined,
        description: description.trim() || undefined,
        minStockLevel: minStockLevel ? Number(minStockLevel) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-cdlp-card border border-cdlp-border rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-cdlp-white">{product ? t('invEditProductTitle') : t('invAddProductTitle')}</h3>
          <button type="button" onClick={onClose} className="text-cdlp-muted hover:text-cdlp-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invProductName')} *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" placeholder={t('invProductNamePlaceholder')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-cdlp-muted block mb-1">{t('invSku')}</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" placeholder={t('invOptional')} />
            </div>
            <div>
              <label className="text-xs text-cdlp-muted block mb-1">{t('invUnit')}</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as UnitOfMeasure)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white">
                {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invBusinessType')}</label>
            <select value={businessType} onChange={(e) => { onBusinessTypeChange(e.target.value); setCategory(''); setSubcategory(''); }} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white">
              <option value="general">{t('invBusinessGeneral')}</option>
              <option value="restaurant">{t('invBusinessRestaurant')}</option>
              <option value="garage">{t('invBusinessGarage')}</option>
              <option value="retail">{t('invBusinessRetail')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-cdlp-muted block mb-1">{t('invCategory')}</label>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white">
                <option value="">{t('invNone')}</option>
                {presets.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-cdlp-muted block mb-1">{t('invSubcategory')}</label>
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" disabled={!selectedPreset?.subcategories}>
                <option value="">{t('invNone')}</option>
                {(selectedPreset?.subcategories || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invMinStock')}</label>
            <input type="number" min="0" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" placeholder={t('invOptional')} />
          </div>

          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invDescription')}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" placeholder={t('invOptional')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="ba-btn text-sm">{t('invCancel')}</button>
          <button type="button" onClick={handleSubmit} disabled={!name.trim() || saving} className="ba-btn ba-btn-primary text-sm">
            {saving ? t('invSaving') : product ? t('invSave') : t('invAddProduct')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementFormDialog({
  productId,
  productName,
  onSave,
  onClose,
}: {
  productId: string;
  productName: string;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<MovementType>('stock_in');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return;
    setSaving(true);
    try {
      const costCents = unitCost ? Math.round(Number(unitCost) * 100) : undefined;
      await onSave({
        productId,
        productName,
        type,
        quantity: qty,
        unitCost: costCents,
        totalCost: costCents != null ? costCents * qty : undefined,
        date,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-cdlp-card border border-cdlp-border rounded-xl w-full max-w-sm p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-cdlp-white">{t('invMovementFor').replace('{name}', productName)}</h3>
          <button type="button" onClick={onClose} className="text-cdlp-muted hover:text-cdlp-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invMovementType')}</label>
            <select value={type} onChange={(e) => setType(e.target.value as MovementType)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white">
              <option value="stock_in">{t('invStockIn')}</option>
              <option value="stock_out">{t('invStockOut')}</option>
              <option value="adjustment">{t('invAdjustment')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-cdlp-muted block mb-1">{t('invQuantity')} *</label>
              <input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" />
            </div>
            <div>
              <label className="text-xs text-cdlp-muted block mb-1">{t('invUnitCost')}</label>
              <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" placeholder={t('invOptional')} />
            </div>
          </div>

          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invMovementDate')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" />
          </div>

          <div>
            <label className="text-xs text-cdlp-muted block mb-1">{t('invNote')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white" placeholder={t('invOptional')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="ba-btn text-sm">{t('invCancel')}</button>
          <button type="button" onClick={handleSubmit} disabled={!quantity || Number(quantity) <= 0 || saving} className="ba-btn ba-btn-primary text-sm">
            {saving ? t('invSaving') : t('invRecordMovement')}
          </button>
        </div>
      </div>
    </div>
  );
}
