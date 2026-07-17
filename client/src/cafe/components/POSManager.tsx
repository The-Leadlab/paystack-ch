import { DEFAULT_SWISS_VAT_RATE } from '@shared/swissVatRates';
import React, { useState } from 'react';
import { Edit2, Trash2, Upload, Save, X, Camera, Zap } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useChfLocale, useLanguage } from '../context/LanguageContext';
import type { POSReading } from '../types';
import { analyzeFinancialDocument } from '../services/geminiService';
import { Z_READING_AI_HINT, parseZReadingFromFinancialData } from '../lib/posZReading';
import '../businessApp.css';

export function POSManager() {
  const { posReadings, addPOSReading, updatePOSReading, deletePOSReading } = usePOS();
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const [editingReading, setEditingReading] = useState<POSReading | null>(null);

  return (
    <div className="space-y-6">
      <div className="ba-page-header">
        <h1>{t('revenue')}</h1>
      </div>

      <POSModal
        inline
        reading={null}
        onClose={() => undefined}
        onSave={addPOSReading}
      />

      <div className="ba-panel">
        <h2 className="text-sm font-black uppercase text-cdlp-gold mb-4">
          {t('posDailyZReadings').replace('{n}', String(posReadings.length))}
        </h2>
        {posReadings.length === 0 ? (
          <p className="text-cdlp-muted text-sm">{t('posNoZReadingsHint')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posReadings.map((reading) => (
              <div key={reading.id} className="ba-panel hover:border-cdlp-gold transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-cdlp-gold">
                      {new Date(reading.date).toLocaleDateString(chfLocale, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-cdlp-muted mt-1">{reading.notes || t('posNoNotes')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingReading(reading)}
                      className="p-1.5 hover:bg-cdlp-card rounded text-cdlp-muted hover:text-cdlp-gold"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('posDeleteZConfirm'))) {
                          void deletePOSReading(reading.id);
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
                    <span className="font-bold text-emerald-500">
                      {reading.gross_sales.toLocaleString(chfLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      CHF
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cdlp-muted">{t('posNetSales')}:</span>
                    <span className="font-bold ba-field-value">
                      {reading.net_sales.toLocaleString(chfLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      CHF
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cdlp-muted">{t('vatBalanceLabel')}:</span>
                    <span className="font-bold text-cdlp-gold">
                      {reading.vat_amount.toLocaleString(chfLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      CHF
                    </span>
                  </div>
                  <div className="border-t border-cdlp-border pt-2 mt-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-cdlp-muted">{t('posCash')}:</span>
                      <span className="font-bold text-cdlp-gold">
                        {reading.cash.toLocaleString(chfLocale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-cdlp-muted">{t('posCard')}:</span>
                      <span className="font-bold text-blue-400">
                        {reading.card.toLocaleString(chfLocale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {reading.other_payment > 0 && (
                      <div className="flex justify-between">
                        <span className="text-cdlp-muted">{t('posOther')}:</span>
                        <span className="font-bold ba-field-value">
                          {reading.other_payment.toLocaleString(chfLocale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  {reading.tips > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>{t('posTips')}:</span>
                      <span className="font-bold">
                        +
                        {reading.tips.toLocaleString(chfLocale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingReading ? (
        <POSModal
          reading={editingReading}
          onClose={() => setEditingReading(null)}
          onSave={async (data) => {
            await updatePOSReading(editingReading.id, data);
            setEditingReading(null);
          }}
        />
      ) : null}
    </div>
  );
}

function POSModal({
  reading,
  onClose,
  onSave,
  inline = false,
}: {
  reading: POSReading | null;
  onClose: () => void;
  onSave: (
    data: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>
  ) => Promise<void>;
  inline?: boolean;
}) {
  const { income } = useFinance();
  const { currentSession } = useSession();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'manual' | 'upload' | 'auto'>(reading ? 'manual' : 'auto');
  const [uploading, setUploading] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(Boolean(reading));

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

  const handleAutoGenerate = () => {
    const dayIncome = income.filter(
      (i) => i.date === date && i.session_id === currentSession?.id
    );
    const totalIncome = dayIncome.reduce((sum, i) => sum + i.amount, 0);
    const vatRate = DEFAULT_SWISS_VAT_RATE / 100;
    const gross = totalIncome;
    const vat = gross * (vatRate / (1 + vatRate));
    const net = gross - vat;

    setGrossSales(gross.toFixed(2));
    setVatAmount(vat.toFixed(2));
    setNetSales(net.toFixed(2));
    setCard((gross * 0.6).toFixed(2));
    setCash((gross * 0.4).toFixed(2));
    setNotes(t('posAutoNotes').replace('{n}', String(dayIncome.length)));
    setShowEntryForm(true);
    setMode('manual');
  };

  const applyDraft = (draft: ReturnType<typeof parseZReadingFromFinancialData>) => {
    setDate(draft.date);
    setGrossSales(draft.gross_sales.toString());
    setNetSales(draft.net_sales.toString());
    setVatAmount(draft.vat_amount.toString());
    setCash(draft.cash.toString());
    setCard(draft.card.toString());
    setOtherPayment(draft.other_payment.toString());
    setTips(draft.tips.toString());
    setDiscounts(draft.discounts.toString());
    setRefunds(draft.refunds.toString());
    setNotes(draft.notes);
    setShowEntryForm(true);
    setMode('manual');
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await analyzeFinancialDocument(file, 'CHF', Z_READING_AI_HINT);
      applyDraft(parseZReadingFromFinancialData(result, date));
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

    if (inline && !reading) {
      setGrossSales('');
      setNetSales('');
      setVatAmount('');
      setCash('');
      setCard('');
      setOtherPayment('0');
      setTips('0');
      setDiscounts('0');
      setRefunds('0');
      setNotes('');
      setShowEntryForm(false);
      setMode('auto');
      return;
    }

    onClose();
  };

  const shellClass = inline
    ? 'ba-panel w-full'
    : 'fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto';

  const panelClass = inline ? 'w-full' : 'ba-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto';

  return (
    <div className={shellClass}>
      <div className={panelClass}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-cdlp-gold uppercase">
              {reading ? t('posEditZReading') : inline ? t('posZWorkspace') : t('posAddZReadingTitle')}
            </h3>
            {inline && !reading ? (
              <p className="text-xs text-cdlp-muted mt-1">{t('posZWorkspaceDesc')}</p>
            ) : null}
          </div>
          {!inline ? (
            <button type="button" onClick={onClose} className="text-cdlp-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        {!reading && (
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 ba-filter-chip ${mode === 'auto' ? 'ba-filter-chip--active' : ''}`}
            >
              <Zap className="w-4 h-4" /> {t('posAutoGenerate')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('manual');
                setShowEntryForm(true);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 ba-filter-chip ${mode === 'manual' ? 'ba-filter-chip--active' : ''}`}
            >
              <Edit2 className="w-4 h-4" /> {t('posManualEntry')}
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 ba-filter-chip ${mode === 'upload' ? 'ba-filter-chip--active' : ''}`}
            >
              <Camera className="w-4 h-4" /> {t('posUploadPhoto')}
            </button>
          </div>
        )}

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
                type="button"
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
                  if (file) void handleFileUpload(file);
                }}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <p className="text-center text-xs text-cdlp-gold mt-2">{t('posAnalyzing')}</p>
            )}
          </div>
        )}

        {(showEntryForm || reading) && mode === 'manual' && (
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
              {!inline ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white"
                >
                  {t('cancel')}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
