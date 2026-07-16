import { DEFAULT_SWISS_VAT_RATE } from '@shared/swissVatRates';
import React, { useState } from 'react';
import { Receipt, Plus, Edit2, Trash2, Upload, Save, X, Camera, DollarSign, CreditCard, Banknote, TrendingUp, TrendingDown, Percent, Zap } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useChfLocale, useLanguage } from '../context/LanguageContext';
import type { POSReading } from '../types';
import { analyzeFinancialDocument } from '../services/geminiService';

import { BusinessKpiCard } from './BusinessKpiCard';
import '../businessApp.css';

export function POSManager() {
  const { posReadings, addPOSReading, updatePOSReading, deletePOSReading } = usePOS();
  const { income, expenses } = useFinance();
  const { currentSession, isAllSessionsView, sessions } = useSession();
  const { t, language } = useLanguage();
  const chfLocale = useChfLocale();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReading, setEditingReading] = useState<POSReading | null>(null);
  const [uploadMode, setUploadMode] = useState<'manual' | 'upload'>('manual');

  // Filter income by session
  // For "All Sessions" view, only show data from existing sessions (not orphaned data)
  const existingSessionIds = sessions.map(s => s.id);
  const filteredIncome = isAllSessionsView 
    ? income.filter(i => existingSessionIds.includes(i.session_id))
    : income.filter(i => i.session_id === currentSession?.id);
  const filteredExpenses = isAllSessionsView
    ? expenses.filter((e) => existingSessionIds.includes(e.session_id))
    : expenses.filter((e) => e.session_id === currentSession?.id);
  
  // Calculate totals from income (for display when no POS readings exist)
  const totalIncomeAmount = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const dashboardBalance = totalIncomeAmount - totalExpenseAmount;
  const vatInclusiveFactor = 1 + DEFAULT_SWISS_VAT_RATE / 100;
  
  // Calculate totals from POS readings
  const totalGrossSales = posReadings.reduce((sum, r) => sum + r.gross_sales, 0);
  const totalNetSales = posReadings.reduce((sum, r) => sum + r.net_sales, 0);
  const totalCash = posReadings.reduce((sum, r) => sum + r.cash, 0);
  const totalCard = posReadings.reduce((sum, r) => sum + r.card, 0);
  
  // Use POS readings if available, otherwise show income data
  const displayGrossSales = posReadings.length > 0 ? totalGrossSales : totalIncomeAmount;
  const displayNetSales =
    posReadings.length > 0 ? totalNetSales : totalIncomeAmount / vatInclusiveFactor;
  const displayCash = posReadings.length > 0 ? totalCash : totalIncomeAmount * 0.4; // Estimate 40% cash
  const displayCard = posReadings.length > 0 ? totalCard : totalIncomeAmount * 0.6; // Estimate 60% card

  const fmt = (n: number) => n.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const flowBase = Math.max(displayGrossSales, displayNetSales, displayCash, displayCard, totalIncomeAmount, 1);

  return (
    <div className="space-y-6">
      <div className="ba-page-header">
        <h1>{t('revenue')}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <BusinessKpiCard
          label={t('income')}
          value={fmt(totalIncomeAmount)}
          hint={t('posDashboardIncomeHint')}
          icon={TrendingUp}
          tone="green"
          progressPct={(totalIncomeAmount / flowBase) * 100}
        />
        <BusinessKpiCard
          label={t('expenses')}
          value={fmt(totalExpenseAmount)}
          hint={t('posDashboardExpenseHint')}
          icon={TrendingDown}
          tone="red"
          progressPct={(totalExpenseAmount / flowBase) * 100}
        />
        <BusinessKpiCard
          label={t('balance')}
          value={fmt(dashboardBalance)}
          icon={DollarSign}
          tone={dashboardBalance >= 0 ? 'green' : 'red'}
          progressPct={(Math.abs(dashboardBalance) / flowBase) * 100}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <BusinessKpiCard label={t('posGrossSales')} value={fmt(displayGrossSales)} icon={TrendingUp} tone="green" progressPct={(displayGrossSales / flowBase) * 100} />
        <BusinessKpiCard label={t('posNetSales')} value={fmt(displayNetSales)} icon={DollarSign} tone="green" progressPct={(displayNetSales / flowBase) * 100} />
        <BusinessKpiCard label={t('posCash')} value={fmt(displayCash)} icon={Banknote} tone="gold" progressPct={(displayCash / flowBase) * 100} />
        <BusinessKpiCard label={t('posCard')} value={fmt(displayCard)} icon={CreditCard} tone="blue" progressPct={(displayCard / flowBase) * 100} />
      </div>
      {posReadings.length === 0 ? (
        <p className="text-[10px] text-cdlp-muted uppercase tracking-wide">{t('posFromIncome')} · {t('posEstimated')}</p>
      ) : null}

      <div className="ba-panel flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('posDailyZReadings').replace('{n}', String(posReadings.length))}</h2>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="ba-btn-start flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {t('posAddZReading')}
        </button>
      </div>

      {/* Readings List */}
      {posReadings.length === 0 ? (
        <div className="ba-panel p-12 text-center">
          <Receipt className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">{t('posNoZReadings')}</h3>
          <p className="text-cdlp-muted text-sm mb-4">{t('posNoZReadingsHint')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
          >
            <Plus className="w-4 h-4" /> {t('posAddZReading')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posReadings.map((reading) => (
            <div key={reading.id} className="ba-panel hover:border-cdlp-gold transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-cdlp-gold">{new Date(reading.date).toLocaleDateString(chfLocale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-cdlp-muted mt-1">{reading.notes || t('posNoNotes')}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingReading(reading)}
                    className="p-1.5 hover:bg-cdlp-card rounded text-cdlp-muted hover:text-cdlp-gold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('posDeleteZConfirm'))) {
                        deletePOSReading(reading.id);
                      }
                    }}
                    className="p-1.5 hover:bg-cdlp-card rounded text-cdlp-muted hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-cdlp-muted">{t('posGrossSales')}:</span>
                  <span className="font-bold text-emerald-500">{reading.gross_sales.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cdlp-muted">{t('posNetSales')}:</span>
                  <span className="font-bold ba-field-value">{reading.net_sales.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cdlp-muted">{t('vatBalanceLabel')}:</span>
                  <span className="font-bold text-cdlp-gold">{reading.vat_amount.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
                </div>
                <div className="border-t border-cdlp-border pt-2 mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-cdlp-muted">{t('posCash')}:</span>
                    <span className="font-bold text-cdlp-gold">{reading.cash.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-cdlp-muted">{t('posCard')}:</span>
                    <span className="font-bold text-blue-400">{reading.card.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {reading.other_payment > 0 && (
                    <div className="flex justify-between">
                      <span className="text-cdlp-muted">{t('posOther')}:</span>
                      <span className="font-bold ba-field-value">{reading.other_payment.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
                {reading.tips > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>{t('posTips')}:</span>
                    <span className="font-bold">+{reading.tips.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingReading) && (
        <POSModal
          reading={editingReading}
          onClose={() => {
            setShowAddModal(false);
            setEditingReading(null);
          }}
          onSave={async (data) => {
            if (editingReading) {
              await updatePOSReading(editingReading.id, data);
            } else {
              await addPOSReading(data);
            }
            setShowAddModal(false);
            setEditingReading(null);
          }}
        />
      )}
    </div>
  );
}

// Modal Component
function POSModal({ reading, onClose, onSave }: {
  reading: POSReading | null;
  onClose: () => void;
  onSave: (data: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>) => Promise<void>;
}) {
  const { income } = useFinance();
  const { currentSession } = useSession();
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const [mode, setMode] = useState<'manual' | 'upload' | 'auto'>('auto');
  const [uploading, setUploading] = useState(false);
  
  const [date, setDate] = useState(reading?.date || new Date().toISOString().split('T')[0]);
  const [grossSales, setGrossSales] = useState(reading?.gross_sales.toString() || '');
  const [netSales, setNetSales] = useState(reading?.net_sales.toString() || '');
  const [vatAmount, setVatAmount] = useState(reading?.vat_amount.toString() || '');
  const [cash, setCash] = useState(reading?.cash.toString() || '');
  const [card, setCard] = useState(reading?.card.toString() || '');
  const [otherPayment, setOtherPayment] = useState(reading?.other_payment.toString() || '0');
  const [tips, setTips] = useState(reading?.tips.toString() || '0');
  const [discounts, setDiscounts] = useState(reading?.discounts.toString() || '0');
  const [refunds, setRefunds] = useState(reading?.refunds.toString() || '0');
  const [notes, setNotes] = useState(reading?.notes || '');

  // Auto-generate from income data
  const handleAutoGenerate = () => {
    // Filter income for selected date and current session
    const dayIncome = income.filter(i => 
      i.date === date && 
      i.session_id === currentSession?.id
    );
    
    const totalIncome = dayIncome.reduce((sum, i) => sum + i.amount, 0);
    
    // Swiss standard VAT (2024+): 8.1% inclusive of gross
    const vatRate = DEFAULT_SWISS_VAT_RATE / 100;
    const gross = totalIncome;
    const vat = gross * (vatRate / (1 + vatRate));
    const net = gross - vat;
    
    // Estimate payment split (60% card, 40% cash - user can adjust)
    const estimatedCard = gross * 0.6;
    const estimatedCash = gross * 0.4;
    
    setGrossSales(gross.toFixed(2));
    setVatAmount(vat.toFixed(2));
    setNetSales(net.toFixed(2));
    setCard(estimatedCard.toFixed(2));
    setCash(estimatedCash.toFixed(2));
    setNotes(t('posAutoNotes').replace('{n}', String(dayIncome.length)));
    
    // Switch to manual mode for editing
    setMode('manual');
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await analyzeFinancialDocument(file, 'CHF');
      
      // Extract data from AI analysis
      setGrossSales(result.totalAmount.toString());
      setNetSales(result.netAmount.toString());
      setVatAmount(result.vatAmount.toString());
      
      // Try to extract payment methods from line items
      if (result.lineItems) {
        const cashItem = result.lineItems.find(item => item.description?.toLowerCase().includes('cash'));
        const cardItem = result.lineItems.find(item => item.description?.toLowerCase().includes('card'));
        
        if (cashItem) setCash(cashItem.amount.toString());
        if (cardItem) setCard(cardItem.amount.toString());
      }
      
      setNotes(result.notes || '');
      setMode('manual'); // Switch to manual mode for editing
    } catch (error) {
      alert(
        t('posAlertAnalyzeError').replace(
          '{msg}',
          error instanceof Error ? error.message : t('errorUnknown')
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSave({
      date,
      gross_sales: parseFloat(grossSales) || 0,
      net_sales: parseFloat(netSales) || 0,
      vat_amount: parseFloat(vatAmount) || 0,
      cash: parseFloat(cash) || 0,
      card: parseFloat(card) || 0,
      other_payment: parseFloat(otherPayment) || 0,
      tips: parseFloat(tips) || 0,
      discounts: parseFloat(discounts) || 0,
      refunds: parseFloat(refunds) || 0,
      notes,
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="ba-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-cdlp-gold uppercase">
            {reading ? t('posEditZReading') : t('posAddZReadingTitle')}
          </h3>
          <button onClick={onClose} className="text-cdlp-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        {!reading && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('auto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 ba-filter-chip ${mode === 'auto' ? 'ba-filter-chip--active' : ''}`}
            >
              <Zap className="w-4 h-4" /> {t('posAutoGenerate')}
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 ba-filter-chip ${mode === 'manual' ? 'ba-filter-chip--active' : ''}`}
            >
              <Edit2 className="w-4 h-4" /> {t('posManualEntry')}
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 ba-filter-chip ${mode === 'upload' ? 'ba-filter-chip--active' : ''}`}
            >
              <Camera className="w-4 h-4" /> {t('posUploadPhoto')}
            </button>
          </div>
        )}

        {/* Auto-Generate Mode */}
        {mode === 'auto' && !reading && (
          <div className="mb-6">
            <div className="ba-subpanel">
              <div className="text-center mb-4">
                <Zap className="w-12 h-12 text-cdlp-gold mx-auto mb-3" />
                <h4 className="text-sm font-bold text-cdlp-gold uppercase mb-2">{t('posAutoGenerateTitle')}</h4>
                <p className="text-xs text-cdlp-muted mb-4">{t('posAutoGenerateDesc')}</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posSelectDate')}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="ba-verify-field"
                />
              </div>

              <button
                onClick={handleAutoGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cdlp-gold text-cdlp-black text-sm font-bold uppercase rounded hover:bg-cdlp-gold-light"
              >
                <Zap className="w-5 h-5" /> {t('posGenerateFromIncome')}
              </button>

              <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/20 rounded text-xs text-blue-400">
                <p className="font-bold mb-1">{t('posHowItWorks')}</p>
                <ul className="list-disc list-inside space-y-1 text-[10px]">
                  <li>{t('posHow1')}</li>
                  <li>{t('posHow2')}</li>
                  <li>{t('posHow3')}</li>
                  <li>{t('posHow4')}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Upload Mode */}
        {mode === 'upload' && !reading && (
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-cdlp-border rounded cursor-pointer hover:bg-cdlp-card transition-colors">
              <Upload className="w-8 h-8 mb-3 text-cdlp-muted" />
              <span className="text-xs font-bold uppercase text-cdlp-gold">{t('posUploadZPhoto')}</span>
              <span className="text-[10px] text-cdlp-muted uppercase mt-1">{t('posFileTypes')}</span>
              <input
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/jpg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <p className="text-center text-xs text-cdlp-gold mt-2">{t('posAnalyzing')}</p>
            )}
          </div>
        )}

        {/* Manual Entry Form */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('date')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="ba-verify-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posGrossSalesChf')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={grossSales}
                  onChange={(e) => setGrossSales(e.target.value)}
                  required
                  className="ba-verify-field"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posNetSalesChf')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={netSales}
                  onChange={(e) => setNetSales(e.target.value)}
                  required
                  className="ba-verify-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posVatAmount')}</label>
              <input
                type="number"
                step="0.01"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                required
                className="ba-verify-field"
              />
            </div>

            <div className="border-t border-cdlp-border pt-4">
              <h4 className="text-xs font-bold uppercase text-cdlp-gold mb-3">{t('posPaymentMethods')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posCash')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    required
                    className="ba-verify-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posCard')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={card}
                    onChange={(e) => setCard(e.target.value)}
                    required
                    className="ba-verify-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posOther')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherPayment}
                    onChange={(e) => setOtherPayment(e.target.value)}
                    className="ba-verify-field"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posTips')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                  className="ba-verify-field"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posDiscounts')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={discounts}
                  onChange={(e) => setDiscounts(e.target.value)}
                  className="ba-verify-field"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posRefunds')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={refunds}
                  onChange={(e) => setRefunds(e.target.value)}
                  className="ba-verify-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posNotes')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="ba-verify-field resize-none !h-auto min-h-[5rem] py-2"
                placeholder={t('posNotesPlaceholder')}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
              >
                <Save className="w-4 h-4" /> {reading ? t('posEditZReading') : t('posAddZReading')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
