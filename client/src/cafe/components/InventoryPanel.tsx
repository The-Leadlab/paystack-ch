import React, { useState, useMemo, useCallback } from 'react';
import {
  Package,
  Plus,
  ArrowUpCircle,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Archive,
  ArchiveRestore,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInventory } from '../context/InventoryContext';
import { useLanguage } from '../context/LanguageContext';
import { useUkUat } from '../context/UkUatContext';
import type {
  InventoryPosRecipe,
  InventoryProductSummary,
  UnitOfMeasure,
  MovementType,
} from '../types/inventory';
import {
  PRODUCT_CATEGORY_PRESETS,
  isCafeDemoSeedSku,
} from '../types/inventory';
import { useDocuments } from '../context/DocumentContext';
import { collectProductLinesFromDocument } from '../lib/documentProductLines';
import { applyDocumentStockIn } from '../lib/applyDocumentStockIn';
import {
  isStockInCandidateDocument,
  normalizeLinesForStockInAnalyze,
} from '@shared/inventoryStockAnalyze';
import { suggestStockInFromLines } from '@shared/inventoryStock';

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

export function InventoryPanel() {
  const {
    products,
    movements,
    recipes,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    addMovement,
    addMovementsBatch,
    deleteMovement,
    deleteMovementsByDocument,
    addRecipe,
    deleteRecipe,
    totalValuation,
  } = useInventory();
  const { documents, updateDocumentData } = useDocuments();
  const { t } = useLanguage();
  const { fiscalLocale, currencySuffix } = useUkUat();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddMovement, setShowAddMovement] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<InventoryProductSummary | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [businessType, setBusinessType] = useState<string>('restaurant');
  const [showArchived, setShowArchived] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  /** Inline cell drafts: productId → field → raw string */
  const [inlineDrafts, setInlineDrafts] = useState<
    Record<string, Partial<{ name: string; sku: string; minStock: string; onHand: string }>>
  >({});

  const patchInline = (productId: string, field: 'name' | 'sku' | 'minStock' | 'onHand', value: string) => {
    setInlineDrafts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  };

  const clearInlineField = (productId: string, field: 'name' | 'sku' | 'minStock' | 'onHand') => {
    setInlineDrafts((prev) => {
      const next = { ...prev[productId] };
      delete next[field];
      const rest = { ...prev };
      if (Object.keys(next).length === 0) delete rest[productId];
      else rest[productId] = next;
      return rest;
    });
  };

  const commitNameSkuMin = async (
    p: InventoryProductSummary,
    field: 'name' | 'sku' | 'minStock',
  ) => {
    const draft = inlineDrafts[p.id]?.[field];
    if (draft === undefined) return;
    try {
      if (field === 'name') {
        const name = draft.trim();
        if (!name || name === p.name) {
          clearInlineField(p.id, field);
          return;
        }
        await updateProduct(p.id, { name });
      } else if (field === 'sku') {
        const sku = draft.trim();
        if ((sku || undefined) === (p.sku || undefined)) {
          clearInlineField(p.id, field);
          return;
        }
        await updateProduct(p.id, { sku: sku || undefined });
      } else {
        const n = draft.trim() === '' ? undefined : Number(draft.replace(',', '.'));
        if (n !== undefined && !Number.isFinite(n)) {
          toast.error(t('invOnHandInvalid') || 'Enter a valid number');
          return;
        }
        if (n === p.minStockLevel || (n == null && p.minStockLevel == null)) {
          clearInlineField(p.id, field);
          return;
        }
        await updateProduct(p.id, { minStockLevel: n });
      }
      clearInlineField(p.id, field);
      toast.success(t('invInlineSaved') || 'Saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const commitOnHand = async (p: InventoryProductSummary) => {
    const draft = inlineDrafts[p.id]?.onHand;
    if (draft === undefined) return;
    const target = Number(String(draft).replace(',', '.'));
    if (!Number.isFinite(target) || target < 0) {
      toast.error(t('invOnHandInvalid') || 'Enter a valid non-negative quantity');
      return;
    }
    const delta = target - p.onHandQty;
    if (Math.abs(delta) < 1e-9) {
      clearInlineField(p.id, 'onHand');
      return;
    }
    try {
      await addMovement({
        productId: p.id,
        productName: p.name,
        type: 'adjustment',
        quantity: delta,
        date: new Date().toISOString().slice(0, 10),
        note: t('invOnHandAdjustNote') || 'On-hand edit from stock table',
      });
      clearInlineField(p.id, 'onHand');
      toast.success(t('invInlineSaved') || 'Saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => (showArchived ? Boolean(p.archived) : !p.archived));
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
  }, [products, searchQuery, categoryFilter, showArchived]);

  /** Scan all session documents / verification lines → create products + stock_in. */
  const analyzeStockFromDocuments = useCallback(async () => {
    setAnalyzing(true);
    try {
      const catalog = products
        .filter((p) => !p.archived)
        .map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
      let docsProcessed = 0;
      let linesApplied = 0;
      let productsCreated = 0;
      let skippedNotStock = 0;

      const inventoryApi = {
        get products() {
          return catalog;
        },
        addProduct: async (p: {
          name: string;
          unit: 'pcs';
          category: string;
          subcategory?: string;
        }) => {
          const id = await addProduct(p);
          catalog.push({ id, name: p.name });
          return id;
        },
        deleteMovementsByDocument,
        addMovementsBatch,
      };

      for (const doc of documents) {
        if (!doc.data) continue;
        const status = String(doc.status || '');
        if (status === 'pending' || status === 'processing' || status === 'error') continue;

        if (!isStockInCandidateDocument(doc.data)) {
          skippedNotStock += 1;
          continue;
        }

        const normalized = normalizeLinesForStockInAnalyze(collectProductLinesFromDocument(doc));
        const rows = suggestStockInFromLines(normalized, catalog);
        if (rows.length === 0) continue;

        const result = await applyDocumentStockIn({
          documentId: doc.id,
          data: doc.data,
          rows,
          inventory: inventoryApi,
        });
        if (result.linesApplied === 0) continue;

        docsProcessed += 1;
        linesApplied += result.linesApplied;
        productsCreated += result.productsCreated;

        if (!doc.data.stockDocument) {
          await updateDocumentData(doc.id, {
            data: { ...doc.data, stockDocument: true },
          });
        }
      }

      if (docsProcessed === 0) {
        toast.message(
          (t('invAnalyzeStockNone') ||
            'No stock items found in documents. Upload supplier invoices, verify line items, then try again.') +
            (skippedNotStock > 0
              ? ` (${skippedNotStock} ${t('invAnalyzeStockSkipped') || 'docs skipped as not stock'})`
              : ''),
        );
      } else {
        toast.success(
          (t('invAnalyzeStockSuccess') ||
            'Analyzed documents · {d} invoices · {l} lines · {p} new products')
            .replace('{d}', String(docsProcessed))
            .replace('{l}', String(linesApplied))
            .replace('{p}', String(productsCreated)),
        );
      }
    } catch (err) {
      console.error('[inventory] analyze stock from documents failed', err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [
    addProduct,
    addMovementsBatch,
    deleteMovementsByDocument,
    documents,
    products,
    t,
    updateDocumentData,
  ]);

  const demoSeedProducts = useMemo(
    () => products.filter((p) => !p.archived && isCafeDemoSeedSku(p.sku)),
    [products],
  );

  const [removingDemo, setRemovingDemo] = useState(false);

  const removeDemoStarters = useCallback(async () => {
    if (demoSeedProducts.length === 0) return;
    if (
      !confirm(
        (t('invRemoveDemoConfirm') ||
          'Remove {n} café demo starter product(s)? Upload-derived products stay.')
          .replace('{n}', String(demoSeedProducts.length)),
      )
    ) {
      return;
    }
    setRemovingDemo(true);
    try {
      try {
        sessionStorage.removeItem('paystack-keep-demo-seed');
      } catch {
        /* ignore */
      }
      for (const p of demoSeedProducts) {
        await deleteProduct(p.id);
      }
      toast.success(
        (t('invRemoveDemoSuccess') || 'Removed {n} demo starter(s)')
          .replace('{n}', String(demoSeedProducts.length)),
      );
    } catch (err) {
      console.error('[inventory] remove demo starters failed', err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingDemo(false);
    }
  }, [demoSeedProducts, deleteProduct, t]);

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-right mr-1 sm:mr-3">
            <div className="text-xs text-cdlp-muted">{t('invTotalStockValue')}</div>
            <div className="text-sm font-semibold text-cdlp-white">{fmtMoney(totalValuation)}</div>
            <div className="text-[10px] text-cdlp-muted">1200 · {t('invStockAssetLine') || 'Inventories'}</div>
          </div>
          <button
            type="button"
            disabled={analyzing || documents.length === 0}
            onClick={() => void analyzeStockFromDocuments()}
            className="ba-btn ba-btn-primary flex items-center gap-1.5 text-sm"
            title={
              t('invAnalyzeStockHint') ||
              'Scan verified document lines, keep stock purchases, skip sales tickets, and fill the catalog.'
            }
          >
            <Sparkles className="w-4 h-4" />
            {analyzing
              ? t('invSaving')
              : t('invAnalyzeStock') || 'Analyze items'}
          </button>
          {demoSeedProducts.length > 0 ? (
            <button
              type="button"
              disabled={removingDemo}
              onClick={() => void removeDemoStarters()}
              className="ba-btn text-sm flex items-center gap-1.5 text-amber-300 border-amber-500/40"
            >
              <Trash2 className="w-4 h-4" />
              {removingDemo
                ? t('invSaving')
                : t('invRemoveDemo') || 'Remove demo starters'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`ba-btn text-sm flex items-center gap-1.5 ${showArchived ? 'border-cdlp-gold text-cdlp-gold' : ''}`}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {showArchived ? t('invShowActive') || 'Active' : t('invShowArchived') || 'Archived'}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddProduct(true); setEditProduct(null); }}
            className="ba-btn ba-btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> {t('invAddProduct')}
          </button>
        </div>
      </div>

      {demoSeedProducts.length > 0 ? (
        <div className="rounded-lg border border-cdlp-border/80 bg-cdlp-card/40 px-3 py-2.5 text-xs text-cdlp-muted leading-relaxed">
          {t('invSeedNotFromUploads') ||
            'These rows are café demo starters (Load opening stock), not products from your uploaded invoices. Real stock comes from supplier invoices: mark as stock on Documents, then Confirm stock-in.'}
        </div>
      ) : null}

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
        <div className="text-center py-12 text-cdlp-muted space-y-4">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {showArchived
              ? t('invNoArchived') || 'No archived products.'
              : products.filter((p) => !p.archived).length === 0
                ? t('invNoProductsYetUploads') ||
                  t('invNoProductsYet') ||
                  'No stock yet — mark supplier invoices as stock on Documents, then Confirm stock-in.'
                : t('invNoProductsMatch')}
          </p>
          {!showArchived && products.filter((p) => !p.archived).length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-cdlp-muted max-w-md mx-auto leading-relaxed">
                {t('invEmptyAnalyzeHint') ||
                  'Upload and verify supplier invoices in Documents, then Analyze items to fill stock from those lines.'}
              </p>
              <button
                type="button"
                disabled={analyzing || documents.length === 0}
                onClick={() => void analyzeStockFromDocuments()}
                className="ba-btn ba-btn-primary inline-flex items-center gap-1.5 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                {analyzing
                  ? t('invSaving')
                  : t('invAnalyzeStock') || 'Analyze items'}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border border-cdlp-border rounded-lg overflow-hidden">
          <ul className="ba-card-list p-3" aria-label={t('invColProduct')}>
            {filteredProducts.map((p) => (
              <li key={`inv-card-${p.id}`}>
                <div className="ba-card-list__item !cursor-default space-y-2">
                  <div className="ba-card-list__row">
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        className="ba-verify-field text-sm w-full font-medium min-h-11"
                        value={inlineDrafts[p.id]?.name ?? p.name}
                        onChange={(e) => patchInline(p.id, 'name', e.target.value)}
                        onBlur={() => void commitNameSkuMin(p, 'name')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        aria-label={t('invColProduct') || 'Product'}
                      />
                      <p className="ba-card-list__meta mt-1">
                        {[p.category, p.sku].filter(Boolean).join(' · ') || '—'}
                        {p.minStockLevel != null && p.onHandQty <= p.minStockLevel
                          ? ` · ${t('invColMinStock') || 'Min'} ${p.minStockLevel}`
                          : ''}
                      </p>
                    </div>
                    <span className="ba-card-list__amount">{fmtMoney(Math.round(p.valuationAmount))}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-cdlp-muted uppercase text-[10px]">{t('invColQtyIn')}</span>
                      <p className="font-bold text-green-400">{p.totalIn}</p>
                    </div>
                    <div>
                      <span className="text-cdlp-muted uppercase text-[10px]">{t('invColQtyOut')}</span>
                      <p className="font-bold text-red-400">{p.totalOut}</p>
                    </div>
                    <div>
                      <span className="text-cdlp-muted uppercase text-[10px]">{t('invColOnHand')}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          className="ba-verify-field text-xs w-full min-h-11 text-right font-semibold"
                          value={inlineDrafts[p.id]?.onHand ?? String(p.onHandQty)}
                          onChange={(e) => patchInline(p.id, 'onHand', e.target.value)}
                          onBlur={() => void commitOnHand(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          aria-label={t('invColOnHand') || 'On hand'}
                        />
                        <span className="text-cdlp-muted shrink-0">{p.unit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ba-card-list__foot">
                    <button
                      type="button"
                      className="ba-filter-chip !py-2 min-h-11"
                      onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                    >
                      {t('invMovementHistory') || 'History'}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-cdlp-muted hover:text-green-400"
                      title={t('invAddMovement')}
                      onClick={() => setShowAddMovement(p.id)}
                    >
                      <ArrowUpCircle className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-cdlp-muted hover:text-cdlp-white"
                      title={t('invEditProduct')}
                      onClick={() => {
                        setEditProduct(p);
                        setShowAddProduct(true);
                      }}
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-cdlp-muted hover:text-red-400"
                      title={t('invDeleteProduct')}
                      onClick={() => {
                        if (confirm(t('invDeleteProductConfirm').replace('{name}', p.name))) {
                          void deleteProduct(p.id)
                            .then(() => toast.success(t('invDeletedToast') || 'Product deleted'))
                            .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
                        }
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  {expandedProduct === p.id ? (
                    <div className="pt-2 border-t border-cdlp-border">
                      <ProductMovementHistory
                        productId={p.id}
                        movements={movements}
                        fmtMoney={fmtMoney}
                        onDeleteMovement={async (id) => {
                          if (!confirm(t('invDeleteMovementConfirm') || 'Delete this movement?')) return;
                          try {
                            await deleteMovement(id);
                            toast.success(t('invMovementDeleted') || 'Movement deleted');
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : String(err));
                          }
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <table className="ba-doc-table ba-table-desktop-only w-full text-sm">
            <thead>
              <tr className="border-b border-cdlp-border bg-cdlp-card/50">
                <th className="text-left px-3 py-2 text-cdlp-muted font-medium">{t('invColProduct')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium hidden md:table-cell">{t('invColSku') || 'SKU'}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium hidden lg:table-cell">{t('invColMinStock') || 'Min'}</th>
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
                    className="border-b border-cdlp-border/50 hover:bg-cdlp-card/30"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="shrink-0 text-cdlp-muted"
                          onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                          aria-label={t('invMovementHistory') || 'History'}
                        >
                          {expandedProduct === p.id ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            className="ba-verify-field text-xs w-full font-medium"
                            value={inlineDrafts[p.id]?.name ?? p.name}
                            onChange={(e) => patchInline(p.id, 'name', e.target.value)}
                            onBlur={() => void commitNameSkuMin(p, 'name')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            aria-label={t('invColProduct') || 'Product'}
                          />
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {isCafeDemoSeedSku(p.sku) ? (
                              <span className="text-[9px] uppercase tracking-wide font-bold text-cdlp-gold/90 bg-cdlp-gold/10 rounded px-1.5 py-0.5">
                                {t('invSeedDemoBadge') || 'Demo starter'}
                              </span>
                            ) : null}
                            {p.minStockLevel != null && p.onHandQty <= p.minStockLevel && (
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-3 py-2 hidden md:table-cell">
                      <input
                        type="text"
                        className="ba-verify-field text-xs w-full text-right"
                        value={inlineDrafts[p.id]?.sku ?? p.sku ?? ''}
                        placeholder="—"
                        onChange={(e) => patchInline(p.id, 'sku', e.target.value)}
                        onBlur={() => void commitNameSkuMin(p, 'sku')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        aria-label={t('invColSku') || 'SKU'}
                      />
                    </td>
                    <td className="text-right px-3 py-2 hidden lg:table-cell">
                      <input
                        type="number"
                        className="ba-verify-field text-xs w-16 ml-auto text-right"
                        value={
                          inlineDrafts[p.id]?.minStock ??
                          (p.minStockLevel != null ? String(p.minStockLevel) : '')
                        }
                        onChange={(e) => patchInline(p.id, 'minStock', e.target.value)}
                        onBlur={() => void commitNameSkuMin(p, 'minStock')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        aria-label={t('invColMinStock') || 'Min stock'}
                      />
                    </td>
                    <td className="text-right px-3 py-2 text-cdlp-muted hidden sm:table-cell">{p.category || '—'}</td>
                    <td className="text-right px-3 py-2 text-green-400">{p.totalIn}</td>
                    <td className="text-right px-3 py-2 text-red-400">{p.totalOut}</td>
                    <td className="text-right px-3 py-2 text-cdlp-white font-semibold">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          className="ba-verify-field text-xs w-20 text-right font-semibold"
                          value={inlineDrafts[p.id]?.onHand ?? String(p.onHandQty)}
                          onChange={(e) => patchInline(p.id, 'onHand', e.target.value)}
                          onBlur={() => void commitOnHand(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          title={t('invOnHandEditHint') || 'Edit on-hand — posts an adjustment movement'}
                          aria-label={t('invColOnHand') || 'On hand'}
                        />
                        <span className="text-cdlp-muted text-xs">{p.unit}</span>
                      </div>
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
                          title={p.archived ? t('invRestoreProduct') || 'Restore' : t('invArchiveProduct') || 'Archive'}
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateProduct(p.id, { archived: !p.archived })
                              .then(() =>
                                toast.success(
                                  p.archived
                                    ? t('invRestoredToast') || 'Product restored'
                                    : t('invArchivedToast') || 'Product archived'
                                )
                              )
                              .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
                          }}
                          className="p-1 rounded hover:bg-cdlp-card text-cdlp-muted hover:text-cdlp-gold transition-colors"
                        >
                          {p.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          title={t('invDeleteProduct')}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t('invDeleteProductConfirm').replace('{name}', p.name))) {
                              void deleteProduct(p.id)
                                .then(() => toast.success(t('invDeletedToast') || 'Product deleted'))
                                .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
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
                      <td colSpan={10} className="bg-cdlp-card/20 px-4 py-3">
                        <ProductMovementHistory
                          productId={p.id}
                          movements={movements}
                          fmtMoney={fmtMoney}
                          onDeleteMovement={async (id) => {
                            if (!confirm(t('invDeleteMovementConfirm') || 'Delete this movement?')) return;
                            try {
                              await deleteMovement(id);
                              toast.success(t('invMovementDeleted') || 'Movement deleted');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : String(err));
                            }
                          }}
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

      <PosRecipesSection
        products={products.filter((p) => !p.archived)}
        recipes={recipes}
        onAdd={addRecipe}
        onDelete={deleteRecipe}
      />

      <div className="rounded-lg border border-cdlp-border bg-cdlp-card/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-cdlp-white">
          <BookOpen className="w-4 h-4 text-cdlp-gold" />
          {t('invSwissWorkflowTitle') || 'Swiss stock workflow (konto 1200)'}
        </div>
        <ol className="text-xs text-cdlp-muted space-y-1.5 list-decimal pl-4">
          <li>{t('invSwissWorkflow1') || 'Add products (or seed café starters). Set a min stock for alerts.'}</li>
          <li>{t('invSwissWorkflow2') || 'Documents → open a supplier invoice → mark as stock → Confirm stock in (HT cost).'}</li>
          <li>{t('invSwissWorkflow3') || 'Factures → link a product on sales lines → save/send decrements stock; cancel restores.'}</li>
          <li>
            {t('invSwissWorkflowPos') ||
              'Documents → Ticket/Receipt or Z2 → Confirm POS stock-out (recipes map till names → ingredients).'}
          </li>
          <li>{t('invSwissWorkflow4') || 'Manual stock out for waste / staff meals; adjustment for physical count (can go negative).'}</li>
          <li>{t('invSwissWorkflow5') || 'Dashboard & Reports show FIFO value as asset 1200 — VAT statement unchanged.'}</li>
        </ol>
        <p className="text-[11px] text-cdlp-muted border-t border-cdlp-border/60 pt-2">
          {t('invPhase2LiveNote') ||
            'POS stock-out is live for itemized tickets / Z2 sheets. Aggregate Z-totals without articles still need recipes + itemized docs. Barcodes / multi-site later.'}
        </p>
      </div>

      {/* Add/Edit Product Dialog */}
      {showAddProduct && (
        <ProductFormDialog
          product={editProduct}
          businessType={businessType}
          onBusinessTypeChange={setBusinessType}
          onSave={async (data) => {
            try {
              if (editProduct) {
                await updateProduct(editProduct.id, data);
                toast.success(t('invSavedToast') || 'Product saved');
              } else {
                await addProduct(data);
                toast.success(t('invAddedToast') || 'Product added');
              }
              setShowAddProduct(false);
              setEditProduct(null);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : String(err));
              throw err;
            }
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
            try {
              await addMovement(data);
              toast.success(t('invMovementToast') || 'Movement recorded');
              setShowAddMovement(null);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : String(err));
              throw err;
            }
          }}
          onClose={() => setShowAddMovement(null)}
        />
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function PosRecipesSection({
  products,
  recipes,
  onAdd,
  onDelete,
}: {
  products: InventoryProductSummary[];
  recipes: InventoryPosRecipe[];
  onAdd: (
    r: Omit<InventoryPosRecipe, 'id' | 'restaurantId' | 'sessionId' | 'createdAt' | 'updatedAt'>,
  ) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [posName, setPosName] = useState('');
  const [productId, setProductId] = useState('');
  const [qtyPerUnit, setQtyPerUnit] = useState('1');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!posName.trim() || !productId) {
      toast.error(t('invPosRecipeValidation') || 'POS name and product are required');
      return;
    }
    const qty = Number(qtyPerUnit);
    if (!(qty > 0)) {
      toast.error(t('invPosRecipeQtyInvalid') || 'Qty per unit must be > 0');
      return;
    }
    setSaving(true);
    try {
      await onAdd({ posName: posName.trim(), productId, qtyPerUnit: qty });
      toast.success(t('invPosRecipeAdded') || 'POS recipe saved');
      setPosName('');
      setQtyPerUnit('1');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-cdlp-border bg-cdlp-card/30 p-4 space-y-3">
      <div>
        <div className="text-sm font-medium text-cdlp-white">
          {t('invPosRecipesTitle') || 'POS recipes (auto stock-out)'}
        </div>
        <p className="text-xs text-cdlp-muted mt-0.5">
          {t('invPosRecipesHint') ||
            'Map till / ticket names to inventory products. Example: Espresso → Coffee beans × 0.018 kg.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-[10px] uppercase text-cdlp-muted block mb-1">
            {t('invPosRecipeName') || 'Till / ticket name'}
          </label>
          <input
            value={posName}
            onChange={(e) => setPosName(e.target.value)}
            className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white"
            placeholder="Espresso"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-cdlp-muted block mb-1">
            {t('invColProduct')}
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white"
          >
            <option value="">{t('invNone')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-cdlp-muted block mb-1">
            {t('invPosRecipeQty') || 'Qty per sold unit'}
          </label>
          <input
            type="number"
            min="0.0001"
            step="any"
            value={qtyPerUnit}
            onChange={(e) => setQtyPerUnit(e.target.value)}
            className="w-full bg-cdlp-black border border-cdlp-border rounded px-2.5 py-1.5 text-sm text-cdlp-white"
          />
        </div>
        <button
          type="button"
          disabled={saving || products.length === 0}
          onClick={() => void submit()}
          className="ba-btn ba-btn-primary text-sm h-[34px]"
        >
          {saving ? t('invSaving') : t('invPosRecipeAdd') || 'Add recipe'}
        </button>
      </div>

      {recipes.length === 0 ? (
        <p className="text-xs text-cdlp-muted italic">
          {t('invPosRecipesEmpty') || 'No recipes yet — stock-out can still match by product name.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {recipes.map((r) => {
            const product = products.find((p) => p.id === r.productId);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 text-xs border border-cdlp-border/50 rounded px-2 py-1.5"
              >
                <span className="text-cdlp-white font-medium">{r.posName}</span>
                <span className="text-cdlp-muted">→</span>
                <span className="text-cdlp-gold">{product?.name || r.productId}</span>
                <span className="text-cdlp-muted tabular-nums">× {r.qtyPerUnit}</span>
                <button
                  type="button"
                  className="ml-auto text-cdlp-muted hover:text-red-400"
                  title={t('invDeleteProduct')}
                  onClick={() => {
                    void onDelete(r.id)
                      .then(() => toast.success(t('invPosRecipeDeleted') || 'Recipe deleted'))
                      .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProductMovementHistory({
  productId,
  movements,
  fmtMoney,
  onDeleteMovement,
}: {
  productId: string;
  movements: { id: string; productId: string; type: MovementType; quantity: number; unitCost?: number; totalCost?: number; date: string; note?: string; invoiceId?: string; documentId?: string }[];
  fmtMoney: (cents: number) => string;
  onDeleteMovement?: (id: string) => void | Promise<void>;
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
          {onDeleteMovement ? (
            <button
              type="button"
              className="ml-auto text-red-400 hover:text-red-300 shrink-0"
              title={t('invDeleteMovement') || 'Delete movement'}
              onClick={() => void onDeleteMovement(m.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
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

  const [adjustDown, setAdjustDown] = useState(false);

  const handleSubmit = async () => {
    const absQty = Math.abs(Number(quantity));
    if (!absQty || absQty <= 0) return;
    // FIFO: negative adjustment = physical shortfall; stock_in/out stay positive.
    const signedQty =
      type === 'adjustment' && adjustDown ? -absQty : absQty;
    setSaving(true);
    try {
      const costCents = unitCost ? Math.round(Number(unitCost) * 100) : undefined;
      await onSave({
        productId,
        productName,
        type,
        quantity: signedQty,
        unitCost: costCents,
        totalCost: costCents != null ? costCents * absQty : undefined,
        date,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const qtyValid = Math.abs(Number(quantity)) > 0;

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

          {type === 'adjustment' ? (
            <label className="flex items-center gap-2 text-xs text-cdlp-white">
              <input type="checkbox" checked={adjustDown} onChange={(e) => setAdjustDown(e.target.checked)} />
              {t('invAdjustDown') || 'Count shortfall (reduce on-hand)'}
            </label>
          ) : null}

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
          <button type="button" onClick={handleSubmit} disabled={!qtyValid || saving} className="ba-btn ba-btn-primary text-sm">
            {saving ? t('invSaving') : t('invRecordMovement')}
          </button>
        </div>
      </div>
    </div>
  );
}
