import React, { useState } from 'react';
import { Receipt, Plus, Edit2, Trash2, Upload, Save, X, Camera, DollarSign, CreditCard, Banknote, TrendingUp, TrendingDown, Percent, Zap } from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import type { POSReading } from '../types';
import { analyzeFinancialDocument } from '../services/geminiService';

export function POSManager() {
  const { posReadings, addPOSReading, updatePOSReading, deletePOSReading } = usePOS();
  const { t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReading, setEditingReading] = useState<POSReading | null>(null);
  const [uploadMode, setUploadMode] = useState<'manual' | 'upload'>('manual');

  const totalGrossSales = posReadings.reduce((sum, r) => sum + r.gross_sales, 0);
  const totalNetSales = posReadings.reduce((sum, r) => sum + r.net_sales, 0);
  const totalCash = posReadings.reduce((sum, r) => sum + r.cash, 0);
  const totalCard = posReadings.reduce((sum, r) => sum + r.card, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 md:w-5 h-4 md:h-5 text-emerald-500" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">Gross Sales</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-emerald-500">{totalGrossSales.toFixed(2)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 md:w-5 h-4 md:h-5 text-emerald-400" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">Net Sales</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-emerald-400">{totalNetSales.toFixed(2)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-4 md:w-5 h-4 md:h-5 text-cdlp-gold" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">Cash</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-cdlp-gold">{totalCash.toFixed(2)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 md:w-5 h-4 md:h-5 text-blue-500" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">Card</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-blue-500">{totalCard.toFixed(2)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>
      </div>

      {/* Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-cdlp-gold uppercase">Daily Z-Readings ({posReadings.length})</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
        >
          <Plus className="w-4 h-4" /> Add Z-Reading
        </button>
      </div>

      {/* Readings List */}
      {posReadings.length === 0 ? (
        <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-12 text-center">
          <Receipt className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">No Z-Readings Yet</h3>
          <p className="text-cdlp-muted text-sm mb-4">Add your first daily closing report</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
          >
            <Plus className="w-4 h-4" /> Add Z-Reading
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posReadings.map((reading) => (
            <div key={reading.id} className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-4 hover:border-cdlp-gold transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-cdlp-gold">{new Date(reading.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-cdlp-muted mt-1">{reading.notes || 'No notes'}</p>
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
                      if (confirm('Delete this Z-reading?')) {
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
                  <span className="text-cdlp-muted">Gross Sales:</span>
                  <span className="font-bold text-emerald-500">{reading.gross_sales.toFixed(2)} CHF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cdlp-muted">Net Sales:</span>
                  <span className="font-bold text-white">{reading.net_sales.toFixed(2)} CHF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cdlp-muted">VAT:</span>
                  <span className="font-bold text-cdlp-gold">{reading.vat_amount.toFixed(2)} CHF</span>
                </div>
                <div className="border-t border-cdlp-border pt-2 mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-cdlp-muted">Cash:</span>
                    <span className="font-bold text-cdlp-gold">{reading.cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-cdlp-muted">Card:</span>
                    <span className="font-bold text-blue-400">{reading.card.toFixed(2)}</span>
                  </div>
                  {reading.other_payment > 0 && (
                    <div className="flex justify-between">
                      <span className="text-cdlp-muted">Other:</span>
                      <span className="font-bold text-white">{reading.other_payment.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {reading.tips > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Tips:</span>
                    <span className="font-bold">+{reading.tips.toFixed(2)}</span>
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
    
    // Assume 7.7% VAT (Swiss standard rate)
    const vatRate = 0.077;
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
    setNotes(`Auto-generated from ${dayIncome.length} income entries`);
    
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
      alert('Error analyzing document: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      <div className="bg-cdlp-black border border-cdlp-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-cdlp-gold uppercase">
            {reading ? 'Edit Z-Reading' : 'Add Z-Reading'}
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
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded ${
                mode === 'auto'
                  ? 'bg-cdlp-gold text-cdlp-black'
                  : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
              }`}
            >
              <Zap className="w-4 h-4" /> Auto-Generate
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded ${
                mode === 'manual'
                  ? 'bg-cdlp-gold text-cdlp-black'
                  : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
              }`}
            >
              <Edit2 className="w-4 h-4" /> Manual Entry
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded ${
                mode === 'upload'
                  ? 'bg-cdlp-gold text-cdlp-black'
                  : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
              }`}
            >
              <Camera className="w-4 h-4" /> Upload Photo
            </button>
          </div>
        )}

        {/* Auto-Generate Mode */}
        {mode === 'auto' && !reading && (
          <div className="mb-6">
            <div className="bg-cdlp-card border border-cdlp-border rounded-lg p-6">
              <div className="text-center mb-4">
                <Zap className="w-12 h-12 text-cdlp-gold mx-auto mb-3" />
                <h4 className="text-sm font-bold text-cdlp-gold uppercase mb-2">Auto-Generate Z-Reading</h4>
                <p className="text-xs text-cdlp-muted mb-4">
                  Automatically create a Z-reading from today's income entries. You can edit all fields after generation.
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Select Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-cdlp-black border border-cdlp-border rounded text-sm text-white"
                />
              </div>

              <button
                onClick={handleAutoGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cdlp-gold text-cdlp-black text-sm font-bold uppercase rounded hover:bg-cdlp-gold-light"
              >
                <Zap className="w-5 h-5" /> Generate from Income Data
              </button>

              <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/20 rounded text-xs text-blue-400">
                <p className="font-bold mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-[10px]">
                  <li>Sums all income entries for the selected date</li>
                  <li>Calculates VAT (7.7% Swiss standard rate)</li>
                  <li>Estimates payment split (60% card, 40% cash)</li>
                  <li>You can edit all values after generation</li>
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
              <span className="text-xs font-bold uppercase text-cdlp-gold">Upload Z-Reading Photo</span>
              <span className="text-[10px] text-cdlp-muted uppercase mt-1">PDF, JPG, PNG</span>
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
              <p className="text-center text-xs text-cdlp-gold mt-2">Analyzing document...</p>
            )}
          </div>
        )}

        {/* Manual Entry Form */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Gross Sales (CHF)</label>
                <input
                  type="number"
                  step="0.01"
                  value={grossSales}
                  onChange={(e) => setGrossSales(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Net Sales (CHF)</label>
                <input
                  type="number"
                  step="0.01"
                  value={netSales}
                  onChange={(e) => setNetSales(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">VAT Amount (CHF)</label>
              <input
                type="number"
                step="0.01"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                required
                className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
              />
            </div>

            <div className="border-t border-cdlp-border pt-4">
              <h4 className="text-xs font-bold uppercase text-cdlp-gold mb-3">Payment Methods</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Cash</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Card</label>
                  <input
                    type="number"
                    step="0.01"
                    value={card}
                    onChange={(e) => setCard(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Other</label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherPayment}
                    onChange={(e) => setOtherPayment(e.target.value)}
                    className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Tips</label>
                <input
                  type="number"
                  step="0.01"
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                  className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Discounts</label>
                <input
                  type="number"
                  step="0.01"
                  value={discounts}
                  onChange={(e) => setDiscounts(e.target.value)}
                  className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Refunds</label>
                <input
                  type="number"
                  step="0.01"
                  value={refunds}
                  onChange={(e) => setRefunds(e.target.value)}
                  className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white resize-none"
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
              >
                <Save className="w-4 h-4" /> {reading ? 'Update' : 'Save'} Z-Reading
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
