import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Upload, CheckCircle, Loader2, Trash2, 
  ChevronDown, ChevronRight, AlertTriangle, 
  ShieldCheck, Zap, Ban, FileSpreadsheet, XCircle,
  Edit3, RefreshCcw, Check, ListOrdered, Terminal,
  SearchCode, Cpu, Landmark, TerminalSquare, ExternalLink,
  ArrowUpRight, ArrowDownRight, Scale as ScaleIcon, Eye, Plus
} from 'lucide-react';
import { analyzeFinancialDocument, syncSwissVatDerivedFields } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { openDocumentInNewTab } from '../lib/openDocumentInNewTab';
import { resolveDocumentProcessingTimeoutMs } from '../lib/documentProcessingTimeout';
import { detectCategory } from '../services/categoryDetectionService';
import {
  ProcessedDocument,
  BankTransaction,
  FinancialData,
  DocumentType,
  PaySlipAnalysis,
  SwissVatRateLine,
} from '../types';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';
import { countCompletedDocumentsThisMonth } from '@shared/planCatalog';

// Restaurant-specific categories adapted from Ypsom - comprehensive categorization
const RESTAURANT_CATEGORIES = [
  { id: 'SALARY', label: 'Salary / Wages', group: 'Personnel' },
  { id: 'PAYROLL_TAXES', label: 'Payroll Taxes / Social Charges', group: 'Personnel' },
  { id: 'RENT', label: 'Rent / Lease', group: 'Fixed Costs' },
  { id: 'UTILITIES', label: 'Utilities / Energy', group: 'Fixed Costs' },
  { id: 'INSURANCE', label: 'Insurance', group: 'Fixed Costs' },
  { id: 'FOOD_SUPPLIES', label: 'Food / Groceries', group: 'Inventory' },
  { id: 'BEVERAGES', label: 'Beverages / Drinks', group: 'Inventory' },
  { id: 'RESTAURANT_SUPPLIES', label: 'Restaurant Supplies / Equipment', group: 'Inventory' },
  { id: 'PACKAGING', label: 'Packaging / Disposables', group: 'Inventory' },
  { id: 'CLEANING', label: 'Cleaning Supplies', group: 'Operations' },
  { id: 'MAINTENANCE', label: 'Maintenance / Repairs', group: 'Operations' },
  { id: 'BANK_FEES', label: 'Bank Fees / Charges', group: 'Financial' },
  { id: 'ACCOUNTING', label: 'Accounting / Professional Services', group: 'Financial' },
  { id: 'MARKETING', label: 'Marketing / Advertising', group: 'Marketing' },
  { id: 'DELIVERY', label: 'Delivery / Transport', group: 'Operations' },
  { id: 'TELECOM', label: 'Internet / Telecom Services', group: 'Fixed Costs' },
  { id: 'OFFICE_SUPPLIES', label: 'Office Supplies', group: 'Operations' },
  { id: 'LICENSES', label: 'Licenses / Permits', group: 'Legal' },
  { id: 'TAXES', label: 'Taxes / VAT', group: 'Financial' },
  { id: 'OTHER', label: 'Other / Miscellaneous', group: 'Other' },
];

// Group categories for better organization
const CATEGORY_GROUPS = [
  { id: 'Personnel', label: 'Personnel Costs' },
  { id: 'Inventory', label: 'Inventory & Supplies' },
  { id: 'Fixed Costs', label: 'Fixed Costs' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Financial', label: 'Financial' },
  { id: 'Marketing', label: 'Marketing' },
  { id: 'Legal', label: 'Legal & Compliance' },
  { id: 'Other', label: 'Other' },
];

// Neural Log Component (from Ypsom)
const NeuralLog: React.FC<{ doc: ProcessedDocument }> = ({ doc }) => {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [showZoom, setShowZoom] = useState(false);

  React.useEffect(() => {
    // Priority: Firebase Storage URL > fileRaw > fileDataUrl (deprecated)
    if (doc.fileUrl) {
      setDocUrl(doc.fileUrl);
    } else if (doc.fileRaw) {
      const url = URL.createObjectURL(doc.fileRaw);
      setDocUrl(url);
      return () => { if (url) URL.revokeObjectURL(url); };
    } else if (doc.fileDataUrl) {
      setDocUrl(doc.fileDataUrl);
    }
  }, [doc.fileUrl, doc.fileRaw, doc.fileDataUrl]);

  const steps = [
    { label: 'Neural Buffer Ingestion', icon: Terminal, delay: '0s' },
    { label: 'Multi-Page Pattern Scan', icon: SearchCode, delay: '0.2s' },
    { label: 'OCR Extraction Logic', icon: Cpu, delay: '0.4s' },
    { label: 'Semantic Fiduciary Mapping', icon: Landmark, delay: '0.6s' },
    { label: 'Integrity Rule Validation', icon: ShieldCheck, delay: '0.8s' },
  ];

  const displayUrl = docUrl;

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-300 font-mono text-[10px]">
      {/* Document Preview Section - Clickable to zoom */}
      {displayUrl && (
        <div 
          className="flex-1 bg-slate-950 border-b border-white/10 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
          onClick={() => setShowZoom(true)}
          title="Click to zoom"
        >
          {doc.fileName?.toLowerCase().endsWith('.pdf') || doc.fileRaw?.type === 'application/pdf' ? (
            <iframe 
              src={displayUrl} 
              className="w-full h-full pointer-events-none"
              title="Document Preview"
            />
          ) : (
            <img 
              src={displayUrl} 
              alt="Document Preview" 
              className="w-full h-full object-contain"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <Eye className="w-8 h-8 text-white" />
          </div>
        </div>
      )}
      
      {/* Zoom Modal */}
      {showZoom && displayUrl && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setShowZoom(false)}
        >
          <button
            onClick={() => setShowZoom(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <XCircle className="w-6 h-6 text-white" />
          </button>
          <div className="max-w-7xl max-h-[90vh] w-full h-full" onClick={(e) => e.stopPropagation()}>
            {doc.fileName?.toLowerCase().endsWith('.pdf') || doc.fileRaw?.type === 'application/pdf' ? (
              <iframe 
                src={displayUrl} 
                className="w-full h-full rounded-lg"
                title="Document Zoom"
              />
            ) : (
              <img 
                src={displayUrl} 
                alt="Document Zoom" 
                className="w-full h-full object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
      
      {/* Extraction Steps */}
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h5 className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-[9px] md:text-[10px]">
            <TerminalSquare className="w-3 h-3" /> Extraction Sequence
          </h5>
          <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full text-[8px] animate-pulse whitespace-nowrap">Live Trace</span>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: step.delay }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <step.icon className="w-3 h-3 text-slate-500" />
              <span className="uppercase tracking-tighter text-slate-400">{step.label}</span>
              <span className="ml-auto text-emerald-500 font-bold opacity-50 hidden sm:inline">COMPLETED</span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <h6 className="text-slate-500 uppercase tracking-widest font-black mb-3 text-[8px]">AI Interpretation Log:</h6>
          <div className="bg-white/5 p-4 rounded-sm italic border-l-2 border-emerald-500/50 leading-relaxed text-slate-200">
            {doc.data?.aiInterpretation || "Scanning document layers for semantic context."}
          </div>
        </div>
        
        <div className="pt-4">
          {/* Open Raw Trace — same control as Ypsom-partners-Financial-counter (opens file in new tab) */}
          {displayUrl && (
            <button
              type="button"
              onClick={() => openDocumentInNewTab(doc)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg text-[9px]"
            >
              <ExternalLink className="w-4 h-4" /> Open Raw Trace
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Editable Line Items Table (Bank Statements, Invoices)
const EditableLineItemsTable: React.FC<{
  items: BankTransaction[];
  currency: string;
  onUpdate: (newItems: BankTransaction[]) => void;
}> = ({ items, currency, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  
  const handleItemChange = (idx: number, field: keyof BankTransaction, value: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value, isHumanVerified: false };
    
    // Auto-detect category when description changes
    if (field === 'description' && value) {
      const detectedCategory = detectCategory(value);
      if (detectedCategory && detectedCategory !== 'OTHER') {
        next[idx].category = detectedCategory;
        console.log(`🎯 Auto-detected category for "${value}": ${detectedCategory}`);
      }
    }
    
    onUpdate(next);
  };

  const toggleVerify = (idx: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], isHumanVerified: !next[idx].isHumanVerified };
    onUpdate(next);
  };

  const addNewRow = () => {
    const newItem: BankTransaction = {
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0,
      type: 'EXPENSE',
      category: 'OTHER', // Will be auto-detected when description is entered
      isHumanVerified: false
    };
    onUpdate([...items, newItem]);
    setShowAddRow(false);
  };

  const deleteRow = (idx: number) => {
    if (confirm('Delete this line item?')) {
      const next = items.filter((_, i) => i !== idx);
      onUpdate(next);
    }
  };

  // Filter items based on search term
  const filteredItems = items.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.amount.toString().includes(searchTerm)
  );

  return (
    <div className="mt-8 space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-cdlp-border pb-3 gap-3">
         <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-cdlp-gold" />
            <h5 className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-cdlp-gold">Line Item Detail Ledger</h5>
         </div>
         <div className="flex items-center gap-2 w-full sm:w-auto">
           {/* Search Bar */}
           <div className="relative flex-1 sm:flex-initial">
             <input
               type="text"
               placeholder="Search items..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full sm:w-48 h-8 px-3 pl-8 bg-cdlp-card border border-cdlp-border rounded text-[10px] text-white placeholder-cdlp-muted outline-none focus:border-cdlp-gold transition-colors"
             />
             <SearchCode className="w-3.5 h-3.5 text-cdlp-muted absolute left-2 top-1/2 -translate-y-1/2" />
           </div>
           {/* Add Button */}
           <button
             onClick={addNewRow}
             className="px-3 h-8 bg-cdlp-gold text-cdlp-black rounded text-[9px] font-black uppercase flex items-center gap-1 hover:bg-cdlp-gold-light transition-colors whitespace-nowrap"
           >
             <Plus className="w-3.5 h-3.5" /> Add
           </button>
           <span className="text-[8px] sm:text-[9px] font-bold text-cdlp-muted opacity-40 uppercase tracking-widest whitespace-nowrap">
             {filteredItems.length}/{items.length}
           </span>
         </div>
      </div>
      
      <div className="border border-cdlp-border rounded-sm overflow-hidden bg-cdlp-black shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-cdlp-gold text-cdlp-black border-b border-cdlp-border">
            <tr className="font-bold uppercase text-[8px] tracking-widest">
              <th className="px-2 py-3 text-center w-10">✓</th>
              <th className="px-2 py-3 text-left w-24">Date</th>
              <th className="px-2 py-3 text-left min-w-[150px]">Description</th>
              <th className="px-2 py-3 text-right w-28">Value ({currency})</th>
              <th className="px-2 py-3 text-center w-20">Type</th>
              <th className="px-2 py-3 text-left min-w-[120px]">Category</th>
              <th className="px-2 py-3 text-center w-10">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cdlp-border">
            {filteredItems.map((item, idx) => {
              const originalIdx = items.indexOf(item);
              return (
                <tr key={originalIdx} className={`hover:bg-cdlp-card/50 transition-colors ${item.isHumanVerified ? 'bg-emerald-900/20' : ''}`}>
                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleVerify(originalIdx); }}
                      className={`w-7 h-7 rounded-sm flex items-center justify-center transition-all ${item.isHumanVerified ? 'bg-emerald-600 text-white shadow-md' : 'bg-cdlp-card text-cdlp-muted hover:text-emerald-600 border border-cdlp-border'}`}
                      title="Mark as verified"
                    >
                      <Check className={`w-3.5 h-3.5 ${item.isHumanVerified ? 'scale-110' : 'scale-90'}`} />
                    </button>
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="date"
                      value={item.date}
                      onChange={e => handleItemChange(originalIdx, 'date', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-cdlp-black border border-cdlp-border rounded px-2 py-1 font-mono text-[10px] text-white outline-none focus:border-cdlp-gold transition-colors"
                    />
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <input 
                      value={item.description}
                      onChange={e => handleItemChange(originalIdx, 'description', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Enter description..."
                      className="w-full bg-cdlp-black border border-cdlp-border rounded px-2 py-1 font-bold text-white text-[10px] outline-none focus:border-cdlp-gold transition-colors placeholder-cdlp-muted"
                    />
                  </td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={e => handleItemChange(originalIdx, 'amount', parseFloat(e.target.value) || 0)}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full bg-cdlp-black border border-cdlp-border rounded px-2 py-1 text-right font-mono font-black text-[11px] outline-none focus:border-cdlp-gold transition-colors ${item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}
                    />
                  </td>
                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <select 
                      value={item.type}
                      onChange={e => handleItemChange(originalIdx, 'type', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full text-[8px] font-black uppercase rounded px-2 py-1 outline-none cursor-pointer border ${item.type === 'INCOME' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30' : 'bg-red-600/20 text-red-400 border-red-600/30'}`}
                    >
                      <option value="INCOME">INC</option>
                      <option value="EXPENSE">EXP</option>
                    </select>
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <select 
                        value={item.category ?? ''} 
                        onChange={e => handleItemChange(originalIdx, 'category', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-cdlp-black border border-cdlp-border rounded px-2 py-1 font-bold text-[9px] text-white outline-none focus:border-cdlp-gold transition-colors pr-6"
                        title={item.category && item.category !== 'OTHER' ? '🤖 Auto-detected category (you can change it)' : 'Select category'}
                      >
                        <option value="">-- Select --</option>
                        {CATEGORY_GROUPS.map(group => (
                          <optgroup key={group.id} label={group.label}>
                            {RESTAURANT_CATEGORIES.filter(cat => cat.group === group.id).map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {item.category && item.category !== 'OTHER' && item.category !== '' && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
                          <span className="text-[8px] bg-emerald-600/20 text-emerald-400 px-1 rounded" title="AI detected">🤖</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRow(originalIdx); }}
                      className="w-7 h-7 rounded-sm flex items-center justify-center text-cdlp-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {filteredItems.length === 0 && searchTerm && (
        <div className="text-center py-8 text-cdlp-muted text-[10px]">
          No items match "{searchTerm}"
        </div>
      )}
    </div>
  );
};

// Editable PaySlip Components Table
const EditablePaySlipTable: React.FC<{
  items: BankTransaction[];
  currency: string;
  onUpdate: (newItems: BankTransaction[]) => void;
}> = ({ items, currency, onUpdate }) => {
  const handleItemChange = (idx: number, field: keyof BankTransaction, value: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value, isHumanVerified: false };
    onUpdate(next);
  };

  const toggleVerify = (idx: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], isHumanVerified: !next[idx].isHumanVerified };
    onUpdate(next);
  };

  return (
    <div className="mt-8 space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-cdlp-border pb-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-emerald-500" />
          <h5 className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-cdlp-gold">
            Pay Slip Components (Earnings / Deductions)
          </h5>
        </div>
        <span className="text-[8px] sm:text-[9px] font-bold text-cdlp-muted opacity-40 uppercase tracking-widest">
          Records: {items.length}
        </span>
      </div>

      <div className="border border-cdlp-border rounded-sm overflow-hidden bg-cdlp-black shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-cdlp-gold text-cdlp-black border-b border-cdlp-border">
            <tr className="font-bold uppercase text-[8px] tracking-widest">
              <th className="px-2 py-3 text-center w-10">Verify</th>
              <th className="px-2 py-3 text-left w-24">Date</th>
              <th className="px-2 py-3 text-left min-w-[180px]">Component</th>
              <th className="px-2 py-3 text-right w-28">Amount ({currency})</th>
              <th className="px-2 py-3 text-center w-24">Type</th>
              <th className="px-2 py-3 text-left min-w-[140px]">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cdlp-border">
            {items.map((item, idx) => (
              <tr
                key={idx}
                className={`hover:bg-cdlp-card transition-colors ${item.isHumanVerified ? 'bg-emerald-900/20' : ''}`}
              >
                <td className="px-2 py-3 text-center">
                  <button
                    onClick={() => toggleVerify(idx)}
                    className={`w-7 h-7 rounded-sm flex items-center justify-center transition-all ${
                      item.isHumanVerified
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-cdlp-card text-cdlp-muted hover:text-emerald-600 border border-cdlp-border'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${item.isHumanVerified ? 'scale-110' : 'scale-90'}`} />
                  </button>
                </td>
                <td className="px-2 py-3">
                  <input
                    type="date"
                    value={item.date || ''}
                    onChange={(e) => handleItemChange(idx, 'date', e.target.value)}
                    className="w-full bg-transparent font-mono text-[10px] text-white outline-none border-b border-transparent focus:border-cdlp-gold"
                  />
                </td>
                <td className="px-2 py-3">
                  <input
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    className="w-full bg-transparent font-bold text-white text-[10px] outline-none border-b border-transparent focus:border-cdlp-gold"
                  />
                </td>
                <td className="px-2 py-3 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                    className={`w-full bg-transparent text-right font-mono font-black text-[10px] outline-none border-b border-transparent focus:border-cdlp-gold ${
                      item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  />
                </td>
                <td className="px-2 py-3 text-center">
                  <select
                    value={item.type}
                    onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                    className={`text-[7px] font-black uppercase rounded-full px-2 py-0.5 outline-none cursor-pointer ${
                      item.type === 'INCOME'
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'bg-red-600/20 text-red-400'
                    }`}
                  >
                    <option value="INCOME">EARN</option>
                    <option value="EXPENSE">DEDUCT</option>
                  </select>
                </td>
                <td className="px-2 py-3">
                  <input
                    value={item.category ?? ''}
                    onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                    className="w-full bg-transparent font-bold text-[9px] text-white outline-none border-b border-transparent focus:border-cdlp-gold"
                    placeholder="e.g. AVS, LPP"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Optional page-range hint from multi-page invoice extraction */
type SubDocPageRange = FinancialData & { pageRange?: string };

const DEFAULT_SWISS_VAT_LINES: SwissVatRateLine[] = [
  { ratePercent: 0, baseExclusive: 0, vatAmount: 0 },
  { ratePercent: 2.6, baseExclusive: 0, vatAmount: 0 },
  { ratePercent: 8.1, baseExclusive: 0, vatAmount: 0 },
];

function roundDocAmount(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function seedSwissTableFromDocument(data: FinancialData): FinancialData {
  const gross = Number(data.totalAmount || 0);
  const vat = Number(data.vatAmount || 0);
  const net = Number(data.netAmount || 0) || Math.max(roundDocAmount(gross - vat), 0);
  return syncSwissVatDerivedFields({
    ...data,
    swissVatBreakdown: [...DEFAULT_SWISS_VAT_LINES],
    swissVatReceiptTotals: {
      merchandiseSubtotal: net,
      vatTotal: vat,
      deposit: 0,
      totalInclVat: gross || roundDocAmount(net + vat),
    },
  });
}

/** Editable Swiss cash-register TVA columns + receipt totals + read-only form-code preview (200/220/400/500). */
const SwissVatBreakdownEditor: React.FC<{
  data: FinancialData;
  onApply: (next: FinancialData) => void;
}> = ({ data, onApply }) => {
  const lines = data.swissVatBreakdown ?? [];
  const totals = data.swissVatReceiptTotals ?? {};
  const preview = data.swissVatFormPreview;
  const cr = Number(data.conversionRateUsed ?? 1) || 1;

  const pushSynced = (patch: Partial<FinancialData>) => {
    const merged = { ...data, ...patch, conversionRateUsed: cr } as FinancialData;
    onApply(syncSwissVatDerivedFields(merged));
  };

  const updateLine = (idx: number, line: SwissVatRateLine) => {
    const next = [...lines];
    next[idx] = line;
    pushSynced({ swissVatBreakdown: next });
  };

  const calcRowVat = (idx: number) => {
    const l = lines[idx];
    if (!l) return;
    const vat = roundDocAmount((Number(l.baseExclusive) || 0) * ((Number(l.ratePercent) || 0) / 100));
    updateLine(idx, { ...l, vatAmount: vat });
  };

  return (
    <div className="mt-8 mb-2 space-y-4 border border-cdlp-border/80 rounded-sm bg-cdlp-card/25 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h5 className="text-[10px] font-black uppercase tracking-widest text-cdlp-gold flex items-center gap-2">
            <ScaleIcon className="w-3.5 h-3.5" /> Swiss TVA — multi-rate & form mapping
          </h5>
          <p className="text-[9px] text-cdlp-muted mt-1 max-w-xl">
            Mirror ticket / facture columns (TVA %, base HT, TVA). Totals and form codes update the document header and exports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {lines.length === 0 ? (
            <button
              type="button"
              onClick={() => onApply(seedSwissTableFromDocument(data))}
              className="h-9 px-3 rounded-sm border border-cdlp-gold/50 bg-cdlp-gold/15 text-cdlp-gold text-[9px] font-black uppercase tracking-wider hover:bg-cdlp-gold/25"
            >
              Add Swiss TVA table
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  pushSynced({
                    swissVatBreakdown: [
                      ...lines,
                      { ratePercent: 3.7, baseExclusive: 0, vatAmount: 0 },
                    ],
                  })
                }
                className="h-9 px-3 rounded-sm border border-cdlp-border bg-cdlp-black text-[9px] font-black uppercase text-foreground hover:border-cdlp-gold/40"
              >
                + Rate row
              </button>
              <button
                type="button"
                onClick={() =>
                  onApply({
                    ...data,
                    swissVatBreakdown: undefined,
                    swissVatReceiptTotals: undefined,
                    swissVatFormPreview: undefined,
                  })
                }
                className="h-9 px-3 rounded-sm border border-red-600/30 bg-red-900/10 text-[9px] font-black uppercase text-red-400 hover:bg-red-900/20"
              >
                Remove table
              </button>
            </>
          )}
        </div>
      </div>

      {lines.length > 0 && (
        <>
          <div className="overflow-x-auto custom-scrollbar -mx-1 px-1">
            <table className="min-w-[640px] w-full text-[10px] border border-cdlp-border/60 rounded-sm overflow-hidden">
              <thead className="bg-cdlp-gold/20 text-cdlp-black uppercase font-black tracking-tight">
                <tr>
                  <th className="px-2 py-2 text-left w-24">TVA %</th>
                  <th className="px-2 py-2 text-right">Base HT</th>
                  <th className="px-2 py-2 text-right">TVA</th>
                  <th className="px-2 py-2 text-center w-28">Calc</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cdlp-border/50 bg-cdlp-black/40">
                {lines.map((line, idx) => (
                  <tr key={`vat-line-${idx}`}>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full h-9 px-2 bg-cdlp-card border border-cdlp-border rounded-sm font-mono font-bold text-foreground"
                        value={line.ratePercent}
                        onChange={(e) =>
                          updateLine(idx, {
                            ...line,
                            ratePercent: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full h-9 px-2 bg-cdlp-card border border-cdlp-border rounded-sm font-mono text-right"
                        value={line.baseExclusive}
                        onChange={(e) =>
                          updateLine(idx, {
                            ...line,
                            baseExclusive: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full h-9 px-2 bg-cdlp-card border border-cdlp-border rounded-sm font-mono text-right text-blue-300"
                        value={line.vatAmount}
                        onChange={(e) =>
                          updateLine(idx, {
                            ...line,
                            vatAmount: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => calcRowVat(idx)}
                        className="h-8 px-2 rounded-sm border border-blue-600/40 text-[8px] font-black uppercase text-blue-300 hover:bg-blue-900/20"
                        title="TVA = base × rate %"
                      >
                        Base×%
                      </button>
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => pushSynced({ swissVatBreakdown: lines.filter((_, i) => i !== idx) })}
                        className="p-1.5 rounded-sm text-cdlp-muted hover:text-red-400 hover:bg-red-900/20"
                        title="Remove row"
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-1">
                Total marchandise (HT)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full h-10 px-3 bg-cdlp-card border border-cdlp-border rounded-sm font-mono text-[11px]"
                value={totals.merchandiseSubtotal ?? ''}
                onChange={(e) =>
                  pushSynced({
                    swissVatReceiptTotals: {
                      ...totals,
                      merchandiseSubtotal: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-1">
                Total TVA
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full h-10 px-3 bg-cdlp-card border border-cdlp-border rounded-sm font-mono text-[11px] text-blue-200"
                value={totals.vatTotal ?? ''}
                onChange={(e) =>
                  pushSynced({
                    swissVatReceiptTotals: {
                      ...totals,
                      vatTotal: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
              <p className="text-[8px] text-cdlp-muted mt-1">With rate rows, TVA follows column sum.</p>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-1">
                Deposit
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full h-10 px-3 bg-cdlp-card border border-cdlp-border rounded-sm font-mono text-[11px]"
                value={totals.deposit ?? ''}
                onChange={(e) =>
                  pushSynced({
                    swissVatReceiptTotals: {
                      ...totals,
                      deposit: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-1">
                Total CHF (TTC)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full h-10 px-3 bg-cdlp-card border border-cdlp-border rounded-sm font-mono text-[11px] font-black text-cdlp-gold"
                value={totals.totalInclVat ?? ''}
                onChange={(e) =>
                  pushSynced({
                    swissVatReceiptTotals: {
                      ...totals,
                      totalInclVat: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </div>

          {preview && (
            <div className="overflow-x-auto">
              <table className="min-w-[520px] w-full text-[9px] border border-cdlp-border/50 rounded-sm">
                <thead className="bg-slate-800 text-slate-200 uppercase font-black">
                  <tr>
                    <th className="px-2 py-2 text-left">Form code</th>
                    <th className="px-2 py-2 text-left">Description</th>
                    <th className="px-2 py-2 text-right">CHF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cdlp-border/40 bg-cdlp-black/30">
                  <tr>
                    <td className="px-2 py-1.5 font-mono font-bold">200</td>
                    <td className="px-2 py-1.5 text-cdlp-muted">Taxable turnover (HT)</td>
                    <td className="px-2 py-1.5 text-right font-mono">{(preview.code200 ?? 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-mono font-bold">220</td>
                    <td className="px-2 py-1.5 text-cdlp-muted">TVA collected (sales)</td>
                    <td className="px-2 py-1.5 text-right font-mono">{(preview.code220 ?? 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 font-mono font-bold">400</td>
                    <td className="px-2 py-1.5 text-cdlp-muted">TVA paid (purchases)</td>
                    <td className="px-2 py-1.5 text-right font-mono">{(preview.code400 ?? 0).toFixed(2)}</td>
                  </tr>
                  <tr className="bg-cdlp-gold/10 font-black">
                    <td className="px-2 py-1.5 font-mono">500</td>
                    <td className="px-2 py-1.5 text-foreground">Net TVA (220 − 400)</td>
                    <td className="px-2 py-1.5 text-right font-mono text-cdlp-gold">{(preview.code500 ?? 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function repairSubTotals(sub: FinancialData): FinancialData {
  let total = Number(sub.totalAmount ?? 0);
  let net = Number(sub.netAmount ?? 0);
  let vat = Number(sub.vatAmount ?? 0);
  const sum = Math.round((net + vat) * 100) / 100;
  if (total <= 0 && net + vat > 1e-6) total = sum;
  else if (Math.abs(total - sum) > 0.051 && net + vat > 1e-6) total = sum;
  else if (total > 0 && Math.abs(net) < 1e-6 && vat <= total + 1e-6) {
    net = Math.round((total - vat) * 100) / 100;
  }
  return { ...sub, totalAmount: total, netAmount: net, vatAmount: vat };
}

function rollUpMultiInvoiceTotals(data: FinancialData): FinancialData {
  const rawSubs = Array.isArray(data.subDocuments) ? data.subDocuments : [];
  if (rawSubs.length === 0) return data;

  const subs = rawSubs.map((s) => repairSubTotals({ ...(s as FinancialData) }));

  const totalAmount = subs.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
  const vatAmount = subs.reduce((s, x) => s + Number(x.vatAmount || 0), 0);
  const netAmount = subs.reduce((s, x) => s + Number(x.netAmount || 0), 0);

  const dates = subs.map((x) => x.date).filter(Boolean).sort();

  const lineItems: BankTransaction[] = subs.map((sub) => {
    const pr = (sub as SubDocPageRange).pageRange;
    return {
      date: sub.date || data.date || new Date().toISOString().slice(0, 10),
      description: `${sub.issuer || 'Unknown issuer'}${pr ? ` (pages ${pr})` : ''}`,
      amount: Number(sub.totalAmount || 0),
      type: 'EXPENSE',
      category: sub.expenseCategory || data.expenseCategory || 'OTHER',
      notes: `VAT Amount ${Number(sub.vatAmount || 0)}`,
    };
  });

  const existingIncome = (data.lineItems || []).filter((i) => i.type === 'INCOME');
  const mergedLineItems = [...existingIncome, ...lineItems];

  const calculatedTotalIncome = mergedLineItems
    .filter((item) => item.type === 'INCOME')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const calculatedTotalExpense = mergedLineItems
    .filter((item) => item.type === 'EXPENSE')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const rate = Number(data.conversionRateUsed ?? 1) || 1;
  const amountInCHF = rate !== 1 ? totalAmount * rate : totalAmount;

  const issuer =
    subs.length > 1 ? `${subs.length} invoices detected` : subs[0]?.issuer || data.issuer;

  return {
    ...data,
    subDocuments: subs,
    totalAmount,
    vatAmount,
    netAmount,
    lineItems: mergedLineItems,
    issuer,
    date: (dates[0] as string) ?? data.date,
    calculatedTotalIncome,
    calculatedTotalExpense,
    amountInCHF,
  };
}

// Verification Hub - Main editing interface
const VerificationHub: React.FC<{ 
  doc: ProcessedDocument; 
  onUpdate: (data: FinancialData) => void;
  onSave: (data: FinancialData) => void;
}> = ({ doc, onUpdate, onSave }) => {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [showSubInvoiceModal, setShowSubInvoiceModal] = useState(false);
  const [activeSubInvoiceTab, setActiveSubInvoiceTab] = useState(0);
  const hasViewableSource = Boolean(doc.fileUrl || doc.fileDataUrl || doc.fileRaw);

  useEffect(() => {
    setActiveSubInvoiceTab(0);
  }, [doc.id, doc.data?.subDocuments?.length ?? 0]);

  const handleFieldChange = (field: keyof FinancialData, value: any) => {
    if (field === 'subDocuments') {
      onUpdate(
        rollUpMultiInvoiceTotals({
          ...doc.data!,
          subDocuments: value as FinancialData[],
        })
      );
      return;
    }

    let newData = { ...doc.data!, [field]: value };

    const subsEarly = Array.isArray(newData.subDocuments) ? newData.subDocuments : [];
    if (field === 'expenseCategory' && subsEarly.length > 1) {
      newData.subDocuments = subsEarly.map((s) => ({
        ...(s as FinancialData),
        expenseCategory: value as string,
      })) as FinancialData[];
      onUpdate(rollUpMultiInvoiceTotals(newData));
      return;
    }

    // When line items change, recalculate totals
    if (field === 'lineItems') {
      const lineItems = value as BankTransaction[];
      const totalIncome = lineItems
        .filter((item) => item.type === 'INCOME')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const totalExpense = lineItems
        .filter((item) => item.type === 'EXPENSE')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      
      // Update calculated totals
      newData.calculatedTotalIncome = totalIncome;
      newData.calculatedTotalExpense = totalExpense;
      
      // For invoices/bills, total amount is the sum of all line items
      // For bank statements, it's income - expense
      const rateAmt = Number(newData.conversionRateUsed ?? 1) || 1;
      if (newData.documentType === DocumentType.BANK_STATEMENT) {
        const net = Math.round((totalIncome - totalExpense) * 100) / 100;
        newData.totalAmount = net;
        newData.amountInCHF = net;
      } else {
        const signedSum = Math.round(lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
        newData.totalAmount = signedSum;
        newData.amountInCHF =
          rateAmt !== 1 ? Math.round(signedSum * rateAmt * 100) / 100 : signedSum;
      }
      
      console.log('📊 Line items changed - recalculated totals:', {
        totalIncome,
        totalExpense,
        totalAmount: newData.totalAmount
      });
    }

    // Keep CHF rollup + live strip aligned when user edits Total Amount directly (single-doc mode).
    if (
      field === 'totalAmount' &&
      newData.documentType !== DocumentType.BANK_STATEMENT &&
      newData.documentType !== DocumentType.PAY_SLIP
    ) {
      const v = Number(value) || 0;
      const r = Number(newData.conversionRateUsed ?? 1) || 1;
      newData.amountInCHF = r !== 1 ? Math.round(v * r * 100) / 100 : Math.round(v * 100) / 100;
    }
    
    // Pay slips: net pay is derived from earnings (INCOME) minus deductions (EXPENSE)
    if (field === 'paySlip') {
      const nextPaySlip: PaySlipAnalysis = value ?? { employee: { name: '' }, employer: { name: '' } };
      const components = nextPaySlip.components ?? [];
      const gross = components
        .filter((c) => c.type === 'INCOME')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const deductions = components
        .filter((c) => c.type === 'EXPENSE')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const net = gross - deductions;

      const nextCurrency = nextPaySlip.currency || newData.originalCurrency || 'CHF';

      newData.originalCurrency = nextCurrency;
      newData.paySlip = {
        ...nextPaySlip,
        currency: nextCurrency,
        grossPay: gross,
        netPay: net,
      };

      newData.vatAmount = 0;
      newData.netAmount = net;
      newData.totalAmount = net;
      newData.amountInCHF = net;
    }
    
    onUpdate(newData);
  };

  const editedData = doc.data!;
  const applyFullFinancialData = (next: FinancialData) => {
    const subs = Array.isArray(next.subDocuments) ? next.subDocuments : [];
    if (subs.length > 1) {
      onUpdate(rollUpMultiInvoiceTotals(next));
      return;
    }
    onUpdate(next);
  };
  const isBankStatement = editedData.documentType === DocumentType.BANK_STATEMENT;
  const isPaySlip = editedData.documentType === DocumentType.PAY_SLIP;
  const isZeroValue = Number(editedData.totalAmount) === 0;
  const subDocuments = Array.isArray(editedData.subDocuments) ? editedData.subDocuments : [];
  const hasMultipleSubs = subDocuments.length > 1;

  const showSwissTvaSection =
    !isBankStatement &&
    !isPaySlip &&
    (editedData.documentType === DocumentType.INVOICE ||
      editedData.documentType === DocumentType.RECEIPT ||
      editedData.documentType === DocumentType.UNKNOWN ||
      editedData.documentType === DocumentType.Z2_BULK_REPORT);

  const subInvoiceTabIdx = Math.min(activeSubInvoiceTab, Math.max(0, subDocuments.length - 1));

  const patchSubDocument = (idx: number, patch: Partial<FinancialData>) => {
    const next = subDocuments.map((s, i) =>
      i === idx ? { ...(s as FinancialData), ...patch } : { ...(s as FinancialData) }
    );
    handleFieldChange('subDocuments', next);
  };

  const lineIncomeSum =
    editedData.lineItems?.filter((i) => i.type === 'INCOME').reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;
  const lineExpenseSum =
    editedData.lineItems?.filter((i) => i.type === 'EXPENSE').reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;
  const subExpenseSum = subDocuments.reduce(
    (s, sd) => s + Number((sd as FinancialData).totalAmount || 0),
    0
  );
  const hasLineItems = (editedData.lineItems?.length ?? 0) > 0;
  const totalExpensesDisplay = hasLineItems
    ? lineExpenseSum
    : subExpenseSum > 0
      ? subExpenseSum
      : Number(editedData.calculatedTotalExpense ?? 0);

  /** Live "document total" must mirror the Total Amount field (rollup/sub-edits/not CHF conversions). */
  const lineSignedSum =
    editedData.lineItems?.reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;
  const primaryTotal = Number(editedData.totalAmount ?? editedData.amountInCHF ?? 0);
  const documentTotalDisplay = isBankStatement
    ? Number(editedData.totalAmount ?? 0)
    : Math.abs(primaryTotal) > 1e-9 || !hasLineItems
      ? primaryTotal
      : Math.round(lineSignedSum * 100) / 100;
  const showLiveCalculation =
    Boolean(subDocuments.length > 0 || (editedData.lineItems && editedData.lineItems.length > 0));

  const currentPaySlip: PaySlipAnalysis = editedData.paySlip ?? { employee: { name: '' }, employer: { name: '' }, components: [] };
  const paySlipComponents = currentPaySlip.components ?? [];
  const computedGrossPay = paySlipComponents.filter((c) => c.type === 'INCOME').reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const computedDeductions = paySlipComponents.filter((c) => c.type === 'EXPENSE').reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const computedNetPay = computedGrossPay - computedDeductions;

  return (
    <div className="bg-cdlp-black border-y border-cdlp-border animate-in slide-in-from-top-2 duration-400 overflow-hidden shadow-inner">
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row min-h-[500px]">
        <div className="w-full lg:w-[320px] xl:w-[420px] bg-slate-900 border-r border-cdlp-border flex flex-col shadow-2xl overflow-hidden shrink-0">
          <NeuralLog doc={doc} />
        </div>
        <div className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 flex flex-col bg-cdlp-black overflow-x-auto overflow-y-visible">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 border-b border-cdlp-border pb-5 gap-4">
              <div>
                 <h4 className="text-[12px] sm:text-[13px] font-black uppercase tracking-widest text-cdlp-gold flex items-center gap-3">
                   Document Verification Center
                 </h4>
                 <p className="text-[9px] sm:text-[10px] font-bold text-cdlp-muted uppercase opacity-50 mt-1 truncate max-w-[200px] sm:max-w-md">{doc.fileName}</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                 {(doc.fileUrl || doc.fileDataUrl || doc.fileRaw) && (
                   <button
                     type="button"
                     onClick={() => openDocumentInNewTab(doc)}
                     className="h-8 px-3 bg-cdlp-card border border-cdlp-border text-cdlp-gold rounded-sm text-[9px] sm:text-[10px] font-black uppercase flex items-center gap-2 hover:border-cdlp-gold transition-colors whitespace-nowrap"
                   >
                     <ExternalLink className="w-3.5 h-3.5" /> Open PDF
                   </button>
                 )}
                 <div className="px-3 py-1.5 bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 rounded-sm text-[9px] sm:text-[10px] font-black uppercase flex items-center gap-2 shadow-sm whitespace-nowrap">
                    <Cpu className="w-3.5 h-3.5" /> Match: {((doc.data?.confidenceScore || 0.95) * 100).toFixed(0)}%
                 </div>
              </div>
           </div>

           {isBankStatement && (
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 p-4 sm:p-6 bg-cdlp-card rounded-sm border border-cdlp-border shadow-sm">
                <div>
                   <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Opening Bal</label>
                   <input 
                     type="number" 
                     value={editedData.openingBalance || 0} 
                     onChange={e => handleFieldChange('openingBalance', parseFloat(e.target.value) || 0)} 
                     className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-mono font-bold text-[10px] text-white outline-none" 
                   />
                </div>
                <div>
                   <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Income (+)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editedData.calculatedTotalIncome || 0} 
                        onChange={e => handleFieldChange('calculatedTotalIncome', parseFloat(e.target.value) || 0)} 
                        className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 pl-7 font-mono font-bold text-[10px] text-emerald-400 outline-none" 
                      />
                      <ArrowUpRight className="w-3 h-3 text-emerald-500 absolute left-2 top-1/2 -translate-y-1/2" />
                   </div>
                </div>
                <div>
                   <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Expense (-)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editedData.calculatedTotalExpense || 0} 
                        onChange={e => handleFieldChange('calculatedTotalExpense', parseFloat(e.target.value) || 0)} 
                        className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 pl-7 font-mono font-bold text-[10px] text-red-400 outline-none" 
                      />
                      <ArrowDownRight className="w-3 h-3 text-red-500 absolute left-2 top-1/2 -translate-y-1/2" />
                   </div>
                </div>
                <div>
                   <label className="text-[8px] font-black uppercase text-amber-600 tracking-widest block mb-2">Final Balance</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editedData.finalBalance || 0} 
                        onChange={e => handleFieldChange('finalBalance', parseFloat(e.target.value) || 0)} 
                        className="w-full bg-cdlp-black border border-amber-600/20 h-9 px-3 pl-7 font-mono font-black text-[10px] text-cdlp-gold outline-none shadow-sm" 
                      />
                      <ScaleIcon className="w-3 h-3 text-amber-600 absolute left-2 top-1/2 -translate-y-1/2" />
                   </div>
                </div>
             </div>
           )}

           {isPaySlip && (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 p-4 sm:p-6 bg-indigo-900/20 rounded-sm border border-cdlp-border shadow-sm">
               <div className="lg:col-span-1">
                 <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Employee Name</label>
                 <input
                   value={currentPaySlip.employee?.name ?? ''}
                   onChange={(e) =>
                     handleFieldChange('paySlip', {
                       ...currentPaySlip,
                       employee: { ...currentPaySlip.employee, name: e.target.value },
                     })
                   }
                   className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-bold text-[10px] text-white outline-none"
                 />
               </div>
               <div>
                 <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Employee ID</label>
                 <input
                   value={currentPaySlip.employee?.idNumber ?? ''}
                   onChange={(e) =>
                     handleFieldChange('paySlip', {
                       ...currentPaySlip,
                       employee: { ...currentPaySlip.employee, idNumber: e.target.value },
                     })
                   }
                   className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-bold text-[10px] text-white outline-none"
                 />
               </div>
               <div className="lg:col-span-1">
                 <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Employer Name</label>
                 <input
                   value={currentPaySlip.employer?.name ?? ''}
                   onChange={(e) =>
                     handleFieldChange('paySlip', {
                       ...currentPaySlip,
                       employer: { ...currentPaySlip.employer, name: e.target.value },
                     })
                   }
                   className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-bold text-[10px] text-white outline-none"
                 />
               </div>

               <div>
                 <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Period Start</label>
                 <input
                   type="date"
                   value={currentPaySlip.periodStart ?? ''}
                   onChange={(e) =>
                     handleFieldChange('paySlip', { ...currentPaySlip, periodStart: e.target.value })
                   }
                   className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-mono text-[10px] text-white outline-none"
                 />
               </div>
               <div>
                 <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Period End</label>
                 <input
                   type="date"
                   value={currentPaySlip.periodEnd ?? ''}
                   onChange={(e) =>
                     handleFieldChange('paySlip', { ...currentPaySlip, periodEnd: e.target.value })
                   }
                   className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-mono text-[10px] text-white outline-none"
                 />
               </div>
               <div>
                 <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest block mb-2">Pay Date</label>
                 <input
                   type="date"
                   value={currentPaySlip.payDate ?? ''}
                   onChange={(e) =>
                     handleFieldChange('paySlip', { ...currentPaySlip, payDate: e.target.value })
                   }
                   className="w-full bg-cdlp-black border border-cdlp-border h-9 px-3 font-mono text-[10px] text-white outline-none"
                 />
               </div>

               <div className="lg:col-span-1">
                 <label className="text-[8px] font-black uppercase text-emerald-600 tracking-widest block mb-2">Gross Pay</label>
                 <div className="w-full bg-cdlp-black border border-emerald-600/20 h-9 px-3 flex items-center font-mono text-[10px] font-black text-emerald-400">
                   {computedGrossPay.toFixed(2)} {editedData.originalCurrency || 'CHF'}
                 </div>
               </div>
               <div className="lg:col-span-1">
                 <label className="text-[8px] font-black uppercase text-red-600 tracking-widest block mb-2">Deductions</label>
                 <div className="w-full bg-cdlp-black border border-red-600/20 h-9 px-3 flex items-center font-mono text-[10px] font-black text-red-400">
                   {computedDeductions.toFixed(2)} {editedData.originalCurrency || 'CHF'}
                 </div>
               </div>
               <div className="lg:col-span-1">
                 <label className="text-[8px] font-black uppercase text-amber-600 tracking-widest block mb-2">Net Pay</label>
                 <div className="w-full bg-cdlp-black border border-amber-600/20 h-9 px-3 flex items-center font-mono text-[10px] font-black text-cdlp-gold">
                   {computedNetPay.toFixed(2)} {editedData.originalCurrency || 'CHF'}
                 </div>
               </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
              <div className="space-y-5">
                 <div>
                    <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">
                      Issuer Entity
                      {hasMultipleSubs && (
                        <span className="block text-[8px] font-bold text-cdlp-muted/70 normal-case tracking-normal mt-0.5">
                          Rolled up from invoices below — edit each sub-invoice issuer.
                        </span>
                      )}
                    </label>
                    <input
                      value={editedData.issuer}
                      onChange={(e) => handleFieldChange('issuer', e.target.value)}
                      readOnly={hasMultipleSubs}
                      className={`w-full h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-bold text-foreground outline-none focus:border-cdlp-gold transition-colors ${hasMultipleSubs ? 'opacity-80 cursor-not-allowed' : ''}`}
                    />
                 </div>
                 {subDocuments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSubInvoiceModal(true)}
                      className="h-11 px-4 bg-cdlp-gold/15 border border-cdlp-gold/40 rounded-sm text-xs font-black text-cdlp-gold uppercase tracking-wider hover:bg-cdlp-gold/25 transition-colors"
                    >
                      {subDocuments.length} invoices detected
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSubInvoiceModal(true)}
                      className="h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-black text-foreground uppercase tracking-wider hover:border-cdlp-gold transition-colors"
                    >
                      Open sub-table analysis
                    </button>
                  </div>
                 )}
                 {hasViewableSource ? (
                   <button
                     type="button"
                     onClick={() => openDocumentInNewTab(doc)}
                     className="w-full h-11 px-4 bg-cdlp-gold text-cdlp-black rounded-sm text-xs font-black uppercase tracking-wider hover:bg-cdlp-gold-light transition-colors flex items-center justify-center gap-2"
                   >
                     <ExternalLink className="w-4 h-4" /> Open PDF
                   </button>
                 ) : (
                   <div className="text-[10px] font-bold text-cdlp-muted bg-cdlp-card border border-cdlp-border rounded-sm px-3 py-2">
                     PDF source is unavailable for this record.
                   </div>
                 )}
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">Currency</label>
                       <input value={editedData.originalCurrency} onChange={e => handleFieldChange('originalCurrency', e.target.value)} className="w-full h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-bold text-foreground outline-none uppercase" placeholder="CHF" />
                    </div>
                    <div>
                       <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">Document #</label>
                       <input value={editedData.documentNumber} onChange={e => handleFieldChange('documentNumber', e.target.value)} className="w-full h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-bold text-foreground outline-none" />
                    </div>
                 </div>
              </div>
              <div className="space-y-5">
                 <div>
                    <label className={`text-[9px] font-black uppercase tracking-[0.2em] block mb-2 flex justify-between ${isZeroValue ? 'text-red-600' : 'text-cdlp-muted'}`}>
                       <span>
                         Total Amount
                         {hasMultipleSubs && <span className="text-[8px] font-bold text-cdlp-muted ml-2">(rollup)</span>}
                         {isZeroValue && <AlertTriangle className="w-3 h-3 inline ml-1 align-text-top" />}
                       </span>
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editedData.totalAmount} 
                        onChange={e => handleFieldChange('totalAmount', parseFloat(e.target.value) || 0)}
                        readOnly={hasMultipleSubs}
                        className={`w-full h-11 px-4 rounded-sm text-xs font-black text-foreground outline-none transition-all ${isZeroValue ? 'bg-red-600/10 border-2 border-red-600' : 'bg-cdlp-card border border-cdlp-border'} ${hasMultipleSubs ? 'opacity-80 cursor-not-allowed' : ''}`} 
                      />
                      {isZeroValue && (
                        <div className="absolute -bottom-5 left-0 text-[8px] font-black text-red-600 uppercase tracking-widest animate-pulse">Value cannot be zero</div>
                      )}
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[9px] font-black uppercase text-blue-600 tracking-[0.2em] block mb-2">
                         VAT Amount{hasMultipleSubs && <span className="text-[8px] text-cdlp-muted ml-1">(rollup)</span>}
                       </label>
                       <input 
                         type="number" 
                         step="0.01" 
                         value={editedData.vatAmount || 0} 
                         onChange={e => handleFieldChange('vatAmount', parseFloat(e.target.value) || 0)}
                         readOnly={hasMultipleSubs}
                        className={`w-full h-11 px-4 bg-blue-600/10 border border-blue-600/20 rounded-sm text-xs font-bold text-foreground outline-none focus:border-blue-600 transition-colors ${hasMultipleSubs ? 'opacity-80 cursor-not-allowed' : ''}`} 
                       />
                    </div>
                    <div>
                       <label className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.2em] block mb-2">
                         Net Amount{hasMultipleSubs && <span className="text-[8px] text-cdlp-muted ml-1">(rollup)</span>}
                       </label>
                       <input 
                         type="number" 
                         step="0.01" 
                         value={editedData.netAmount || 0} 
                         onChange={e => handleFieldChange('netAmount', parseFloat(e.target.value) || 0)}
                         readOnly={hasMultipleSubs}
                        className={`w-full h-11 px-4 bg-emerald-600/10 border border-emerald-600/20 rounded-sm text-xs font-bold text-foreground outline-none focus:border-emerald-600 transition-colors ${hasMultipleSubs ? 'opacity-80 cursor-not-allowed' : ''}`} 
                       />
                    </div>
                 </div>
              </div>
              <div className="space-y-5 md:col-span-2 xl:col-span-1">
                 <div>
                    <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">
                      Date{hasMultipleSubs && <span className="text-[8px] font-bold text-cdlp-muted/80 ml-2">(earliest)</span>}
                    </label>
                    <input
                      type="date"
                      value={editedData.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      readOnly={hasMultipleSubs}
                      className={`w-full h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-bold text-foreground outline-none ${hasMultipleSubs ? 'opacity-80 cursor-not-allowed' : ''}`}
                    />
                 </div>
                 <div className="pt-1 sm:pt-0">
                    <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">Category</label>
                    <div className="flex gap-2">
                      {isAddingCustom ? (
                        <input 
                          autoFocus
                          value={editedData.expenseCategory} 
                          onChange={e => handleFieldChange('expenseCategory', e.target.value)} 
                          placeholder="Type custom..."
                          className="flex-1 h-11 px-4 bg-cdlp-black border border-cdlp-border rounded-sm text-[10px] font-black text-foreground uppercase outline-none shadow-inner"
                        />
                      ) : (
                        <select value={editedData.expenseCategory} onChange={e => handleFieldChange('expenseCategory', e.target.value)} className={`flex-1 h-11 px-4 bg-cdlp-black border border-cdlp-border rounded-sm text-[10px] font-black text-foreground uppercase outline-none`}>
                           <option value="">-- Uncategorized --</option>
                           {CATEGORY_GROUPS.map(group => (
                             <optgroup key={group.id} label={group.label}>
                               {RESTAURANT_CATEGORIES.filter(cat => cat.group === group.id).map(cat => (
                                 <option key={cat.id} value={cat.id}>{cat.label}</option>
                               ))}
                             </optgroup>
                           ))}
                           {!RESTAURANT_CATEGORIES.some(c => c.id === editedData.expenseCategory) && editedData.expenseCategory && (
                             <option value={editedData.expenseCategory}>{editedData.expenseCategory}</option>
                           )}
                        </select>
                      )}
                      <button 
                        onClick={() => setIsAddingCustom(!isAddingCustom)} 
                        className={`w-11 h-11 rounded-sm border flex items-center justify-center transition-all shrink-0 ${isAddingCustom ? 'bg-cdlp-gold text-cdlp-black' : 'bg-cdlp-card border-cdlp-border text-cdlp-muted'}`}
                      >
                        {isAddingCustom ? <CheckCircle className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                      </button>
                    </div>
                 </div>
              </div>
           </div>

           {showSwissTvaSection && !hasMultipleSubs && (
             <SwissVatBreakdownEditor data={editedData} onApply={applyFullFinancialData} />
           )}

           {subDocuments.length > 0 && !isPaySlip && (
             <div className="mt-8 mb-6 space-y-3">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cdlp-border pb-2">
                 <h5 className="text-[10px] font-black uppercase tracking-widest text-cdlp-gold flex items-center gap-2">
                   <ListOrdered className="w-3.5 h-3.5" /> Document verification — per invoice
                 </h5>
                 <span className="text-[8px] text-cdlp-muted uppercase tracking-tight">
                   One tab per invoice; header Total = sum of all tabs.
                 </span>
               </div>
               <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto border-b border-cdlp-border/80">
                 {subDocuments.map((raw, idx) => {
                   const sub = raw as FinancialData;
                   const active = idx === subInvoiceTabIdx;
                   return (
                     <button
                       key={`inv-tab-${idx}-${sub.issuer || 'inv'}`}
                       type="button"
                       onClick={() => setActiveSubInvoiceTab(idx)}
                       className={`shrink-0 text-left px-3 py-2 rounded-sm border transition-colors min-w-[120px] max-w-[200px] ${
                         active
                           ? 'bg-cdlp-gold text-cdlp-black border-cdlp-gold shadow-md'
                           : 'bg-cdlp-card/40 text-foreground border-cdlp-border hover:border-cdlp-gold/40'
                       }`}
                     >
                       <span className="block text-[9px] font-black uppercase tracking-tight truncate">
                         #{idx + 1} {sub.issuer || 'Invoice'}
                       </span>
                       <span className="block font-mono text-[10px] mt-1 opacity-90">
                         {(Number(sub.totalAmount || 0)).toLocaleString('en-CH', {
                           minimumFractionDigits: 2,
                           maximumFractionDigits: 2,
                         })}{' '}
                         {editedData.originalCurrency || 'CHF'}
                       </span>
                     </button>
                   );
                 })}
               </div>
               {subDocuments.length > 0 && (() => {
                 const idx = subInvoiceTabIdx;
                 const raw = subDocuments[idx];
                 const sub = raw as FinancialData;
                 const pageRange = (sub as SubDocPageRange).pageRange;
                 return (
                   <div className="border border-cdlp-border rounded-sm bg-cdlp-card/35 p-4 mt-3">
                     <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-cdlp-border/50">
                       <span className="text-[10px] font-black uppercase text-cdlp-gold tracking-widest">
                         Invoice {idx + 1} of {subDocuments.length}
                       </span>
                       {pageRange && (
                         <span className="text-[9px] font-bold text-cdlp-muted">Pages {pageRange}</span>
                       )}
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                       <div className="space-y-2 md:col-span-2 xl:col-span-1">
                         <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest">Issuer</label>
                         <input
                           value={sub.issuer ?? ''}
                           onChange={(e) => patchSubDocument(idx, { issuer: e.target.value })}
                           className="w-full h-10 px-3 bg-cdlp-black border border-cdlp-border rounded-sm text-[11px] font-bold text-foreground outline-none focus:border-cdlp-gold"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest">Pages (range)</label>
                         <input
                           value={pageRange ?? ''}
                           onChange={(e) => {
                             const next: SubDocPageRange = { ...(sub as SubDocPageRange), pageRange: e.target.value };
                             patchSubDocument(idx, next as FinancialData);
                           }}
                           className="w-full h-10 px-3 bg-cdlp-black border border-cdlp-border rounded-sm text-[11px] font-bold text-foreground outline-none focus:border-cdlp-gold"
                           placeholder="e.g. 1–2"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest">Date</label>
                         <input
                           type="date"
                           value={sub.date ?? ''}
                           onChange={(e) => patchSubDocument(idx, { date: e.target.value })}
                           className="w-full h-10 px-3 bg-cdlp-black border border-cdlp-border rounded-sm text-[11px] font-bold text-foreground outline-none"
                         />
                       </div>
                       <div className="space-y-2 md:col-span-2 xl:col-span-3">
                         <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest">Category</label>
                         <select
                           value={sub.expenseCategory || ''}
                           onChange={(e) => patchSubDocument(idx, { expenseCategory: e.target.value })}
                           className="w-full h-10 px-3 bg-cdlp-black border border-cdlp-border rounded-sm text-[10px] font-black text-foreground uppercase outline-none"
                         >
                           <option value="">— Uncategorized —</option>
                           {CATEGORY_GROUPS.map((group) => (
                             <optgroup key={group.id} label={group.label}>
                               {RESTAURANT_CATEGORIES.filter((cat) => cat.group === group.id).map((cat) => (
                                 <option key={cat.id} value={cat.id}>
                                   {cat.label}
                                 </option>
                               ))}
                             </optgroup>
                           ))}
                         </select>
                       </div>
                       <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-emerald-600 tracking-widest">Net</label>
                         <input
                           type="number"
                           step="0.01"
                           value={sub.netAmount ?? 0}
                           onChange={(e) => {
                             const net = parseFloat(e.target.value) || 0;
                             const vat = Number(sub.vatAmount || 0);
                             patchSubDocument(idx, {
                               netAmount: net,
                               totalAmount: Math.round((net + vat) * 100) / 100,
                             });
                           }}
                           className="w-full h-10 px-3 bg-emerald-600/10 border border-emerald-600/25 rounded-sm text-[11px] font-bold outline-none"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-blue-600 tracking-widest">VAT</label>
                         <input
                           type="number"
                           step="0.01"
                           value={sub.vatAmount ?? 0}
                           onChange={(e) => {
                             const vat = parseFloat(e.target.value) || 0;
                             const net = Number(sub.netAmount || 0);
                             patchSubDocument(idx, {
                               vatAmount: vat,
                               totalAmount: Math.round((net + vat) * 100) / 100,
                             });
                           }}
                           className="w-full h-10 px-3 bg-blue-600/10 border border-blue-600/25 rounded-sm text-[11px] font-bold outline-none"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-cdlp-muted tracking-widest">Total (gross)</label>
                         <input
                           type="number"
                           step="0.01"
                           value={sub.totalAmount ?? 0}
                           onChange={(e) => {
                             const gross = parseFloat(e.target.value) || 0;
                             const vat = Number(sub.vatAmount || 0);
                             patchSubDocument(idx, {
                               totalAmount: gross,
                               netAmount: Math.round((gross - vat) * 100) / 100,
                             });
                           }}
                           className="w-full h-10 px-3 bg-cdlp-card border border-cdlp-border rounded-sm text-[11px] font-black outline-none"
                         />
                       </div>
                     </div>
                     {(() => {
                       const dt = sub.documentType;
                       const subSwissEligible =
                         !isPaySlip &&
                         dt !== DocumentType.BANK_STATEMENT &&
                         dt !== DocumentType.PAY_SLIP &&
                         (dt === DocumentType.INVOICE ||
                           dt === DocumentType.RECEIPT ||
                           dt === DocumentType.UNKNOWN ||
                           dt === DocumentType.Z2_BULK_REPORT);
                       if (!subSwissEligible) return null;
                       const crSub = Number(sub.conversionRateUsed) || Number(editedData.conversionRateUsed) || 1;
                       return (
                         <div className="mt-4 pt-4 border-t border-cdlp-border/60">
                           <SwissVatBreakdownEditor
                             data={{ ...sub, conversionRateUsed: crSub }}
                             onApply={(next) => {
                               patchSubDocument(idx, {
                                 swissVatBreakdown: next.swissVatBreakdown,
                                 swissVatReceiptTotals: next.swissVatReceiptTotals,
                                 swissVatFormPreview: next.swissVatFormPreview,
                                 vatAmount: next.vatAmount,
                                 netAmount: next.netAmount,
                                 totalAmount: next.totalAmount,
                                 amountInCHF: next.amountInCHF,
                                 conversionRateUsed: next.conversionRateUsed ?? crSub,
                               });
                             }}
                           />
                         </div>
                       );
                     })()}
                   </div>
                 );
               })()}
             </div>
           )}

           {/* Live totals: aligned with rolled-up expense lines or sub-documents */}
           {showLiveCalculation && !isPaySlip && (
             <div className="mt-6 mb-4 p-4 bg-gradient-to-r from-emerald-900/20 to-red-900/20 border border-cdlp-border rounded-lg">
               <div className="flex items-center justify-between mb-3">
                 <h5 className="text-[10px] font-black uppercase tracking-widest text-cdlp-gold flex items-center gap-2">
                   <RefreshCcw className="w-3.5 h-3.5" /> Live Calculation
                 </h5>
                 <span className="text-[8px] text-cdlp-muted uppercase">Auto-updates as you edit</span>
               </div>
               <div className="grid grid-cols-3 gap-4">
                 <div className="bg-emerald-900/20 border border-emerald-600/30 rounded p-3">
                   <p className="text-[8px] font-black uppercase text-emerald-600 mb-1">Total Income</p>
                   <p className="text-lg font-black text-emerald-400">
                     {lineIncomeSum.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <p className="text-[8px] text-emerald-600/60">{editedData.originalCurrency || 'CHF'}</p>
                 </div>
                 <div className="bg-red-900/20 border border-red-600/30 rounded p-3">
                   <p className="text-[8px] font-black uppercase text-red-600 mb-1">Total Expenses</p>
                   <p className="text-lg font-black text-red-400">
                     {totalExpensesDisplay.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <p className="text-[8px] text-red-600/60">{editedData.originalCurrency || 'CHF'}</p>
                 </div>
                 <div className="bg-cdlp-gold/20 border border-cdlp-gold/30 rounded p-3">
                   <p className="text-[8px] font-black uppercase text-cdlp-gold mb-1">Document Total</p>
                   <p className="text-lg font-black text-cdlp-gold">
                     {documentTotalDisplay.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <p className="text-[8px] text-cdlp-gold/60">{editedData.originalCurrency || 'CHF'}</p>
                 </div>
               </div>
               <div className="mt-3 text-center">
                 <p className="text-[9px] text-cdlp-muted">
                   Document total mirrors the Total Amount field (above). Income and expenses columns come from live line types. Save to sync the dashboard.
                 </p>
               </div>
             </div>
           )}

           <div className="flex-1 overflow-y-auto mt-6 min-h-[300px] max-h-[400px] custom-scrollbar">
             {isPaySlip ? (
               <EditablePaySlipTable
                 items={currentPaySlip.components ?? []}
                 currency={editedData.originalCurrency}
                 onUpdate={(newComponents) =>
                   handleFieldChange('paySlip', {
                     ...currentPaySlip,
                     currency: editedData.originalCurrency,
                     components: newComponents,
                   })
                 }
               />
             ) : editedData.lineItems && editedData.lineItems.length > 0 ? (
               <EditableLineItemsTable
                 items={editedData.lineItems}
                 currency={editedData.originalCurrency}
                 onUpdate={(newItems) => handleFieldChange('lineItems', newItems)}
               />
             ) : (
               <div className="py-20 text-center border-2 border-dashed border-cdlp-border rounded-sm bg-cdlp-card/30">
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-cdlp-muted opacity-30">
                    No line-item data available
                  </p>
               </div>
             )}
           </div>
           
          {/* Sticky Save Button - boosted contrast and visibility */}
          <div className="sticky bottom-0 pt-6 pb-2 border-t-2 border-cdlp-gold/40 mt-6 bg-gradient-to-t from-cdlp-black via-cdlp-black/95 to-transparent">
              <div className="bg-cdlp-card border border-cdlp-border rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase text-emerald-400">Ready to Save</span>
                  </div>
                  <span className="text-[8px] text-cdlp-muted">All changes will be applied</span>
                </div>
                <div className="text-[8px] text-cdlp-muted space-y-1">
                  <p>✓ Document data will be updated</p>
                  <p>✓ Dashboard income/expenses will be recalculated</p>
                  <p>✓ Totals will refresh automatically</p>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  console.log('💾 SAVE BUTTON CLICKED - Saving document with data:', editedData);
                  onSave({ ...editedData, isHumanVerified: true });
                }} 
                disabled={isZeroValue}
                className={`w-full h-16 rounded-lg font-black text-[11px] sm:text-[12px] uppercase tracking-[0.28em] shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_18px_40px_rgba(0,0,0,0.45)] transition-all flex items-center justify-center gap-3 ${isZeroValue ? 'bg-cdlp-card text-cdlp-muted cursor-not-allowed border-red-600/30 border' : 'bg-cdlp-gold text-cdlp-black border border-cdlp-gold-light hover:bg-cdlp-gold-light hover:scale-[1.01]'}`}
              >
                <ShieldCheck className="w-6 h-6" /> 
                <span>Save & Update Dashboard</span>
                <RefreshCcw className="w-5 h-5" />
              </button>
              <p className="text-center text-[9px] text-cdlp-gold-light mt-3 uppercase tracking-wider font-black">
                ⚡ Click to apply all changes and sync with dashboard
              </p>
           </div>
        </div>
      </div>
      {showSubInvoiceModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowSubInvoiceModal(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[85vh] overflow-auto bg-card border border-border rounded-lg shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h4 className="text-sm sm:text-base font-black uppercase tracking-wider text-foreground">
                Invoice Breakdown ({subDocuments.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowSubInvoiceModal(false)}
                className="h-8 px-3 rounded border border-border bg-background text-foreground text-xs font-bold hover:border-cdlp-gold transition-colors"
              >
                Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted text-foreground uppercase font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Issuer</th>
                    <th className="px-3 py-2 text-left">Pages</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">VAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subDocuments.map((raw, idx) => {
                    const subDoc = raw as FinancialData;
                    const pr = (subDoc as SubDocPageRange).pageRange;
                    return (
                      <tr key={`modal-${subDoc.issuer || 'invoice'}-${idx}`} className="text-foreground align-top">
                        <td className="px-2 py-2 font-bold">{idx + 1}</td>
                        <td className="px-2 py-2 min-w-[140px]">
                          <input
                            value={subDoc.issuer ?? ''}
                            onChange={(e) => patchSubDocument(idx, { issuer: e.target.value })}
                            className="w-full min-w-[120px] bg-background border border-border rounded px-2 py-1 text-[11px] font-semibold"
                          />
                        </td>
                        <td className="px-2 py-2 w-24">
                          <input
                            value={pr ?? ''}
                            onChange={(e) => {
                              const next: SubDocPageRange = { ...(subDoc as SubDocPageRange), pageRange: e.target.value };
                              patchSubDocument(idx, next as FinancialData);
                            }}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 w-36">
                          <input
                            type="date"
                            value={subDoc.date ?? ''}
                            onChange={(e) => patchSubDocument(idx, { date: e.target.value })}
                            className="w-full bg-background border border-border rounded px-1 py-1 text-[10px]"
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[120px]">
                          <select
                            value={subDoc.expenseCategory || ''}
                            onChange={(e) => patchSubDocument(idx, { expenseCategory: e.target.value })}
                            className="w-full bg-background border border-border rounded px-1 py-1 text-[10px] font-bold uppercase"
                          >
                            <option value="">—</option>
                            {RESTAURANT_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right w-28">
                          <input
                            type="number"
                            step="0.01"
                            value={subDoc.totalAmount ?? 0}
                            onChange={(e) => {
                              const gross = parseFloat(e.target.value) || 0;
                              const vat = Number(subDoc.vatAmount || 0);
                              patchSubDocument(idx, {
                                totalAmount: gross,
                                netAmount: Math.round((gross - vat) * 100) / 100,
                              });
                            }}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-right font-mono"
                          />
                        </td>
                        <td className="px-2 py-2 text-right w-28">
                          <input
                            type="number"
                            step="0.01"
                            value={subDoc.netAmount ?? 0}
                            onChange={(e) => {
                              const net = parseFloat(e.target.value) || 0;
                              const vat = Number(subDoc.vatAmount || 0);
                              patchSubDocument(idx, {
                                netAmount: net,
                                totalAmount: Math.round((net + vat) * 100) / 100,
                              });
                            }}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-right font-mono"
                          />
                        </td>
                        <td className="px-2 py-2 text-right w-28">
                          <input
                            type="number"
                            step="0.01"
                            value={subDoc.vatAmount ?? 0}
                            onChange={(e) => {
                              const vat = parseFloat(e.target.value) || 0;
                              const net = Number(subDoc.netAmount || 0);
                              patchSubDocument(idx, {
                                vatAmount: vat,
                                totalAmount: Math.round((net + vat) * 100) / 100,
                              });
                            }}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-right font-mono"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Showing {subDocuments.length} extracted invoice blocks from the full document.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/** Firestore `documents/{id}` path — use queue-time id when present so delete/update never uses a stale client-generated id */
function firestoreRecordId(doc: ProcessedDocument): string {
  const p = doc.persistedDocumentId;
  if (typeof p === 'string' && p.length > 0) return p;
  return doc.id;
}

// Main Document Processor Component
export const DocumentProcessor: React.FC<{ 
  documents: ProcessedDocument[], 
  updateDocument: (documentId: string, updates: Partial<ProcessedDocument>) => Promise<void>,
  onDeleteDocument: (documentId: string) => Promise<void>,
  onDocumentQueued?: (fileName: string, fileHash?: string, fileRaw?: File) => Promise<string>,
  onDataExtracted: (data: any, fileName: string, fileHash?: string, fileRaw?: File, persistedDocumentId?: string) => void,
  onDocumentUpdated?: (documentId: string, newData: FinancialData) => Promise<void>
}> = ({ documents, updateDocument, onDeleteDocument, onDocumentQueued, onDataExtracted, onDocumentUpdated }) => {
  const { enforcementEnabled, entitlements } = useSubscription();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reportingCurrency] = useState('CHF');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<ProcessedDocument[]>([]);
  const [reattachTargetId, setReattachTargetId] = useState<string | null>(null);
  const reattachInputRef = useRef<HTMLInputElement>(null);
  const stopProcessingRef = useRef(false);
  const dragCounter = useRef(0);

  // Processing throughput: configurable via env, capped to avoid overloading browsers/devices.
  const CONCURRENCY_LIMIT = Math.min(
    6,
    Math.max(1, parseInt((import.meta.env.VITE_DOCUMENT_PROCESSING_CONCURRENCY || '3').trim(), 10) || 3)
  );

  // Combine Firestore documents with local processing documents
  const allDocs = useMemo(() => {
    const firestoreDocs = documents.map(d => ({ ...d, source: 'firestore' as const }));
    const localProcessing = localDocs.filter(ld => !documents.some(d => d.fileName === ld.fileName));
    return [...firestoreDocs, ...localProcessing];
  }, [documents, localDocs]);

  const isQueuedStatus = (status?: ProcessedDocument['status']) =>
    status === 'pending' || status === 'error' || status === 'skipped';

  const canProcessDoc = (doc: ProcessedDocument & { source?: 'firestore' | 'local' }) =>
    Boolean(doc.fileRaw || doc.fileUrl || (doc as any).source !== 'firestore');

  const classifyDocFlowType = (data?: FinancialData): 'INCOME' | 'EXPENSE' | 'SALARY' => {
    const cat = String(data?.expenseCategory || '').toUpperCase();
    if (cat.includes('REVENUE') || cat.includes('SALES')) return 'INCOME';
    if (cat.includes('PAYROLL') || cat.includes('SALARY') || cat.includes('PAYSLIP')) return 'SALARY';
    return 'EXPENSE';
  };

  const applyDocFlowType = async (
    doc: (ProcessedDocument & { source?: 'firestore' | 'local' }),
    flowType: 'INCOME' | 'EXPENSE' | 'SALARY'
  ) => {
    if (!doc.data) return;
    const currentCategory = String(doc.data.expenseCategory || '').toUpperCase();
    let nextCategory = doc.data.expenseCategory;
    if (flowType === 'INCOME') {
      nextCategory = 'REVENUE';
    } else if (flowType === 'SALARY') {
      nextCategory = 'PAYROLL';
    } else if (
      currentCategory.includes('REVENUE') ||
      currentCategory.includes('SALES') ||
      currentCategory.includes('PAYROLL') ||
      currentCategory.includes('SALARY')
    ) {
      nextCategory = 'OTHER';
    }

    const nextData: FinancialData = { ...doc.data, expenseCategory: nextCategory };

    if ((doc as any).source === 'firestore') {
      const recordId = firestoreRecordId(doc);
      await updateDocument(recordId, { data: nextData });
      if (onDocumentUpdated) await onDocumentUpdated(recordId, nextData);
      return;
    }

    setLocalDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, data: nextData } : d)));
  };

  const stats = useMemo(() => {
    const total = allDocs.length;
    const completed = allDocs.filter(d => d.status === 'completed').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, progress };
  }, [allDocs]);

  // Generate SHA-256 hash for file
  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploadError(null);
    const incoming = Array.from(files);
    
    // Check for duplicate filenames
    const duplicateNames = incoming.filter(f => documents.some(d => d.fileName === f.name));
    
    // Check for duplicate file content (hash)
    const duplicateHashes: string[] = [];
    const uniqueFiles: File[] = [];
    
    for (const file of incoming) {
      if (duplicateNames.includes(file)) continue; // Skip filename duplicates
      
      const hash = await generateFileHash(file);
      const isDuplicateHash = documents.some(d => d.fileHash === hash);
      
      if (isDuplicateHash) {
        duplicateHashes.push(file.name);
      } else {
        uniqueFiles.push(file);
      }
    }
    
    if (duplicateNames.length > 0 || duplicateHashes.length > 0) {
      const messages = [];
      if (duplicateNames.length > 0) {
        messages.push(`${duplicateNames.length} duplicate filename(s)`);
      }
      if (duplicateHashes.length > 0) {
        messages.push(`${duplicateHashes.length} duplicate file(s) detected (same content)`);
      }
      setUploadError(`Ignored: ${messages.join(', ')}`);
    }
    
    // Add files to local state for processing with hash
    const news: ProcessedDocument[] = await Promise.all(
      uniqueFiles.map(async (f: File) => {
        const hash = await generateFileHash(f);
        let persistedDocumentId: string | undefined;
        try {
          if (onDocumentQueued) {
            persistedDocumentId = await onDocumentQueued(f.name, hash, f);
          }
        } catch (queueErr: any) {
          return {
            id: Math.random().toString(36).substr(2, 9),
            fileName: f.name,
            status: 'error' as const,
            fileRaw: f,
            fileHash: hash,
            error: `Failed to queue save: ${queueErr?.message || 'Unknown error'}`,
          };
        }

        return {
          id: Math.random().toString(36).substr(2,9), 
          fileName: f.name, 
          status: 'pending' as const, 
          fileRaw: f,
          fileHash: hash,
          persistedDocumentId
        };
      })
    );
    
    setLocalDocs((p) => [...p, ...news]);
  };

  const processDoc = async (doc: ProcessedDocument & { source?: 'firestore' | 'local' }) => {
    const isFirestoreDoc = (doc as any).source === 'firestore';
    const firestoreId = isFirestoreDoc ? firestoreRecordId(doc) : undefined;

    setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'processing', error: undefined } : d));
    if (isFirestoreDoc && firestoreId) {
      await updateDocument(firestoreId, { status: 'processing', error: undefined });
    }

    try {
      console.log(`Processing: ${doc.fileName}`);

      let inputFile: File | undefined = doc.fileRaw;
      if (!inputFile && doc.persistedDocumentId) {
        const { getCachedDocumentFile } = await import('../services/storageService');
        inputFile = (await getCachedDocumentFile(doc.persistedDocumentId, doc.fileName)) || undefined;
      }
      if (!inputFile && doc.fileDataUrl) {
        try {
          const dataUrlResp = await fetch(doc.fileDataUrl);
          const blob = await dataUrlResp.blob();
          inputFile = new File([blob], doc.fileName, { type: blob.type || 'application/octet-stream' });
        } catch (dataUrlErr) {
          console.warn('⚠️ fileDataUrl fallback failed:', dataUrlErr);
        }
      }
      if (!inputFile && doc.fileUrl) {
        // Rehydrate persisted documents after page refresh.
        const { downloadDocumentFile } = await import('../services/storageService');
        inputFile = await downloadDocumentFile(doc.fileUrl, doc.fileName);
      }
      if (!inputFile) {
        throw new Error('Missing source file or storage unreachable. Re-upload this document once to create local backup, then retry.');
      }

      const cap = entitlements.maxDocumentsPerMonth;
      if (enforcementEnabled && cap != null) {
        const used = countCompletedDocumentsThisMonth(
          [...documents, ...localDocs].map((d) => ({ status: d.status, created_at: d.created_at }))
        );
        if (used >= cap) {
          const msg = t('planLimitDocuments').replace('{n}', String(cap));
          setLocalDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'error', error: msg } : d)));
          if (isFirestoreDoc && firestoreId) {
            await updateDocument(firestoreId, { status: 'error', error: msg });
          }
          return;
        }
      }

      const processingTimeoutMs = resolveDocumentProcessingTimeoutMs(inputFile);
      const timeoutSec = Math.round(processingTimeoutMs / 1000);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Processing timeout (${timeoutSec}s). Very large PDFs can exceed this—click retry or set VITE_DOCUMENT_PROCESSING_TIMEOUT_MS (milliseconds) and redeploy.`
              )
            ),
          processingTimeoutMs
        )
      );
      const res = await Promise.race([
        analyzeFinancialDocument(inputFile, reportingCurrency),
        timeoutPromise,
      ]);
      console.log(`✅ Completed: ${doc.fileName}`);
      
      const completedAt = doc.created_at || new Date().toISOString();
      setLocalDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, status: 'completed', data: res, created_at: completedAt } : d
        )
      );
      
      // Auto-extract data and save to Firestore with file metadata
      try {
        console.log(`💾 Saving document: ${doc.fileName}`);
        await onDataExtracted(res, doc.fileName, doc.fileHash, inputFile, doc.persistedDocumentId);
        console.log(`✅ Document saved successfully: ${doc.fileName}`);
      } catch (saveErr: any) {
        console.error(`❌ Failed to save document: ${doc.fileName}`, saveErr);
        // Mark as error but keep the analyzed data
        setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'error', error: `Failed to save: ${saveErr.message}` } : d));
        if (isFirestoreDoc && firestoreId) {
          await updateDocument(firestoreId, { status: 'error', error: `Failed to save: ${saveErr.message}` });
        }
      }
    } catch (err: any) {
      console.error(`❌ Error: ${doc.fileName}`, err);
      setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'error', error: err.message } : d));
      if (isFirestoreDoc && firestoreId) {
        await updateDocument(firestoreId, { status: 'error', error: err.message });
      }
    }
  };

  const skipDoc = (docId: string) => {
    setLocalDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'skipped' as const, error: 'Skipped by user' } : d));
  };

  const retryDoc = async (docId: string) => {
    const doc = localDocs.find(d => d.id === docId);
    if (doc) {
      setLocalDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'pending', error: undefined } : d));
      await processDoc(doc);
    }
  };

  const startReattach = (docId: string) => {
    setReattachTargetId(docId);
    reattachInputRef.current?.click();
  };

  const onReattachFileSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !reattachTargetId) return;
    const target = allDocs.find((d) => d.id === reattachTargetId);
    setReattachTargetId(null);
    if (!target) return;

    try {
      if (target.persistedDocumentId) {
        const { cacheDocumentFile } = await import('../services/storageService');
        await cacheDocumentFile(target.persistedDocumentId, file);
      }

      await processDoc({
        ...target,
        fileRaw: file,
        status: 'pending',
        error: undefined,
      } as ProcessedDocument & { source?: 'firestore' | 'local' });
    } catch (err) {
      console.error('Reattach and process failed:', err);
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;

    const cap = entitlements.maxDocumentsPerMonth;
    let pending = allDocs.filter((d) => isQueuedStatus(d.status) && canProcessDoc(d as any));
    if (enforcementEnabled && cap != null) {
      const used = countCompletedDocumentsThisMonth(
        [...documents, ...localDocs].map((d) => ({ status: d.status, created_at: d.created_at }))
      );
      const remaining = Math.max(0, cap - used);
      if (remaining === 0) {
        setUploadError(t('planLimitDocuments').replace('{n}', String(cap)));
        setIsProcessing(false);
        return;
      }
      pending = pending.slice(0, remaining);
    }
    let index = 0;
    const activeTasks = new Set<Promise<void>>();

    while (index < pending.length && !stopProcessingRef.current) {
      while (activeTasks.size < CONCURRENCY_LIMIT && index < pending.length && !stopProcessingRef.current) {
        const doc = pending[index++];
        // Reset status to pending before processing
        setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'pending', error: undefined } : d));
        const task = processDoc(doc).finally(() => activeTasks.delete(task));
        activeTasks.add(task);
      }
      if (activeTasks.size > 0) await Promise.race(activeTasks);
    }
    
    await Promise.all(activeTasks);
    setIsProcessing(false);
  };

  const stopBatch = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedRows(next);
  };

  return (
    <div 
      className="space-y-6"
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; addFiles(e.dataTransfer.files); }}
    >
      <div className="bg-cdlp-black border border-cdlp-border p-4 md:p-6 rounded-lg shadow-card">
        {uploadError && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-600 text-red-400 text-xs font-bold uppercase flex items-center justify-between rounded">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {uploadError}</span>
            <button onClick={() => setUploadError(null)} className="hover:text-red-300"><XCircle className="w-4 h-4" /></button>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Upload Area */}
          <div className="lg:col-span-5">
            <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded cursor-pointer transition-all ${isDragging ? 'border-cdlp-gold bg-cdlp-gold/10 scale-105' : 'border-cdlp-border hover:bg-cdlp-card'}`}>
              <Upload className="w-8 h-8 mb-3 text-cdlp-muted" />
              <div className="text-center px-4">
                <span className="text-xs font-bold uppercase tracking-wider block text-cdlp-gold">Upload Documents</span>
                <span className="text-[10px] text-cdlp-muted uppercase tracking-wider mt-1 block">Drop PDF / JPG / PNG files</span>
                <span className="text-[9px] text-cdlp-muted/60 uppercase tracking-wider mt-1 block">Click rows below to view & edit</span>
              </div>
              <input type="file" className="hidden" multiple accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp" onChange={(e) => addFiles(e.target.files)} />
            </label>
          </div>

          {/* Controls */}
          <div className="lg:col-span-3 flex flex-col justify-between gap-3">
            {isProcessing ? (
              <button onClick={stopBatch} className="w-full h-12 bg-red-600 text-white rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-700">
                <Ban className="w-4 h-4" /> Stop Processing
              </button>
            ) : (
              <button 
                onClick={processAll} 
                disabled={allDocs.filter((d) => isQueuedStatus(d.status) && canProcessDoc(d as any)).length === 0} 
                className="w-full h-12 bg-cdlp-gold text-cdlp-black rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-30 hover:bg-cdlp-gold-light"
              >
                <ShieldCheck className="w-4 h-4" /> Start Processing ({allDocs.filter((d) => isQueuedStatus(d.status) && canProcessDoc(d as any)).length})
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="lg:col-span-4 flex flex-col h-40 border border-cdlp-border rounded bg-cdlp-card p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[10px] font-bold text-cdlp-muted uppercase tracking-wider mb-1">Queue Status</p>
                <p className="text-xs font-bold text-cdlp-gold">{stats.completed} / {stats.total} DONE</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="w-full h-1.5 bg-cdlp-border rounded-full overflow-hidden mb-2">
                <div className="h-full bg-cdlp-gold transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
              </div>
              <p className="text-[10px] font-bold text-cdlp-muted text-center uppercase tracking-wider">{stats.progress.toFixed(0)}% Complete</p>
            </div>
            <div className="mt-3 bg-cdlp-black border border-cdlp-border rounded p-2 flex items-center justify-center gap-2">
              <Zap className="w-3 h-3 text-cdlp-gold" />
              <span className="text-[10px] font-bold text-cdlp-gold uppercase">5x Parallel Processing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      {allDocs.length > 0 && (
        <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar max-w-[100vw] sm:max-w-none">
            <table className="min-w-[720px] w-full text-xs">
              <thead className="bg-cdlp-gold text-cdlp-black uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Amount</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Type</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">TVA Calc</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cdlp-border">
                {allDocs.map((doc) => {
                  const isExpanded = expandedRows.has(doc.id);
                  const vat = Number(doc.data?.vatAmount || 0);
                  const swissLines = doc.data?.swissVatBreakdown;
                  const subDocs = Array.isArray(doc.data?.subDocuments) ? doc.data?.subDocuments : [];
                  const extractedRateValues = (
                    swissLines && swissLines.length > 0
                      ? swissLines.map((l) => Number(l.ratePercent || 0))
                      : subDocs.length > 0
                        ? subDocs.map((s) => Number(s.vatRate || 0))
                        : [Number(doc.data?.vatRate || 0)]
                  )
                    .filter((r) => Number.isFinite(r) && r > 0)
                    .map((r) => Math.round(r * 100) / 100);
                  const uniqueRateValues = Array.from(new Set(extractedRateValues));
                  const extractedRateLabel =
                    uniqueRateValues.length > 0
                      ? uniqueRateValues.map((r) => `${r.toFixed(2)}%`).join(' / ')
                      : '';
                  const vatNeedsAttention = vat <= 0;
                  return (
                    <React.Fragment key={doc.id}>
                      <tr 
                        onClick={() => doc.status === 'completed' && toggleRow(doc.id)} 
                        className={`hover:bg-cdlp-card transition-colors ${doc.status === 'completed' ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-cdlp-card' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {doc.status === 'completed' && (
                              isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-cdlp-gold" /> : <ChevronRight className="w-3.5 h-3.5 text-cdlp-muted" />
                            )}
                            <span className="font-bold text-white text-[11px] truncate max-w-[200px]">{doc.fileName}</span>
                          </div>
                          {doc.data?.issuer && (
                            <div className="ml-5 mt-1">
                              <span className="px-2 py-0.5 bg-cdlp-gold/20 text-cdlp-gold text-[9px] font-bold uppercase rounded">{doc.data.issuer}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-cdlp-muted hidden md:table-cell">{doc.data?.date || '---'}</td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-[11px] text-white hidden md:table-cell">
                          {doc.data ? (doc.data.amountInCHF || doc.data.totalAmount || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell align-top">
                          {doc.data ? (
                            <select
                              value={classifyDocFlowType(doc.data)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={async (e) => {
                                e.stopPropagation();
                                await applyDocFlowType(
                                  doc as ProcessedDocument & { source?: 'firestore' | 'local' },
                                  e.target.value as 'INCOME' | 'EXPENSE' | 'SALARY'
                                );
                              }}
                              className="h-8 min-w-[120px] bg-cdlp-black border border-cdlp-border rounded px-2 text-[10px] font-bold uppercase text-white"
                              title="Select document flow type"
                            >
                              <option value="INCOME">Income</option>
                              <option value="EXPENSE">Expense</option>
                              <option value="SALARY">Salary</option>
                            </select>
                          ) : (
                            <span className="text-[10px] text-cdlp-muted">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell align-top max-w-[240px]">
                          {doc.data ? (
                            swissLines && swissLines.length > 0 ? (
                              <div className="font-mono leading-snug space-y-0.5">
                                <p className={`text-[10px] font-bold ${vat > 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                                  Σ{' '}
                                  {vat.toLocaleString('en-CH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                                {swissLines.slice(0, 5).map((l, i) => (
                                  <p key={i} className="text-[8px] text-cdlp-muted">
                                    {(Number(l.ratePercent || 0)).toFixed(2)}% du{' '}
                                    {(Number(l.baseExclusive || 0)).toFixed(2)} ={' '}
                                    {(Number(l.vatAmount || 0)).toFixed(2)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <div className="font-mono leading-tight">
                                <p className={`text-[11px] font-bold ${vatNeedsAttention ? 'text-amber-400' : 'text-blue-400'}`}>
                                  {vat.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[9px] text-cdlp-muted">
                                  {vatNeedsAttention
                                    ? 'Warning: VAT 0.00 — file needs attention'
                                    : extractedRateLabel || 'Rate missing in source'}
                                </p>
                              </div>
                            )
                          ) : (
                            <span className="text-[10px] text-cdlp-muted">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.status === 'processing' && <Loader2 className="w-4 h-4 text-cdlp-gold animate-spin" />}
                            {doc.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {doc.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                            {doc.status === 'skipped' && <Ban className="w-4 h-4 text-amber-500" />}
                            <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:inline ${
                              doc.status === 'completed' ? 'text-emerald-500' : 
                              doc.status === 'error' ? 'text-red-500' : 
                              doc.status === 'skipped' ? 'text-amber-500' :
                              'text-cdlp-muted'
                            }`}>{doc.status}</span>
                            {doc.status === 'completed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isExpanded) toggleRow(doc.id);
                                }}
                                className="px-2 py-1 bg-cdlp-gold/15 hover:bg-cdlp-gold/25 text-cdlp-gold text-[9px] font-bold uppercase rounded transition-colors"
                                title="Open Document Verification Center"
                              >
                                Verification Center
                              </button>
                            )}
                            
                            {/* Skip button - show when processing or error */}
                            {(doc.status === 'processing' || doc.status === 'error') && (doc as any).source !== 'firestore' && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  skipDoc(doc.id);
                                }} 
                                className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1"
                                title="Skip this document"
                              >
                                <Ban className="w-3 h-3" />
                                <span className="hidden lg:inline">Skip</span>
                              </button>
                            )}
                            
                            {/* Retry button - show when skipped */}
                            {doc.status === 'skipped' && (doc as any).source !== 'firestore' && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  retryDoc(doc.id);
                                }} 
                                className="px-2 py-1 bg-cdlp-gold/20 hover:bg-cdlp-gold/30 text-cdlp-gold text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1"
                                title="Retry processing this document"
                              >
                                <RefreshCcw className="w-3 h-3" />
                                <span className="hidden lg:inline">Retry</span>
                              </button>
                            )}

                            {doc.status === 'error' && (doc as any).source === 'firestore' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startReattach(doc.id);
                                }}
                                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1"
                                title="Reattach the file and retry processing"
                              >
                                <Upload className="w-3 h-3" />
                                <span className="hidden lg:inline">Reattach</span>
                              </button>
                            )}
                            
                            {doc.fileRaw && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  const url = URL.createObjectURL(doc.fileRaw);
                                  window.open(url, '_blank');
                                }} 
                                className="text-cdlp-muted/50 hover:text-cdlp-gold transition-colors"
                                title="View document in new tab"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button 
                              onClick={async (e) => { 
                                e.stopPropagation();
                                if (!confirm(`Delete "${doc.fileName}"?`)) return;
                                if (typeof onDeleteDocument !== 'function') {
                                  console.error('Document delete handler is unavailable');
                                  alert('Delete action is temporarily unavailable. Please refresh and try again.');
                                  return;
                                }
                                if ((doc as any).source === 'firestore') {
                                  const recordId = firestoreRecordId(doc);
                                  try {
                                    if (doc.persistedDocumentId) {
                                      const { deleteCachedDocumentFile } = await import('../services/storageService');
                                      await deleteCachedDocumentFile(doc.persistedDocumentId);
                                    }
                                    if (doc.fileUrl) {
                                      const { deleteDocument: deleteStoredFile } = await import('../services/storageService');
                                      await deleteStoredFile(doc.fileUrl);
                                    }
                                  } catch (storageErr) {
                                    console.warn('Storage delete skipped/failed:', storageErr);
                                  }
                                  try {
                                    await onDeleteDocument(recordId);
                                  } catch (deleteErr) {
                                    console.error('Failed to delete document record:', deleteErr);
                                    alert('Could not delete the document record. Please try again.');
                                  }
                                } else {
                                  // Remove from local state
                                  setLocalDocs(p => p.filter(d => d.id !== doc.id));
                                }
                              }} 
                              className="text-cdlp-muted/30 hover:text-red-500 transition-colors"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {doc.data && swissLines && swissLines.length > 0 && (
                        <tr className="md:hidden">
                          <td colSpan={6} className="px-4 pb-3">
                            <div className="font-mono space-y-0.5 border border-cdlp-border rounded bg-cdlp-card/40 p-2">
                              {swissLines.slice(0, 3).map((l, i) => (
                                <p key={i} className="text-[8px] text-cdlp-muted">
                                  {(Number(l.ratePercent || 0)).toFixed(2)}% du{' '}
                                  {(Number(l.baseExclusive || 0)).toFixed(2)} ={' '}
                                  {(Number(l.vatAmount || 0)).toFixed(2)}
                                </p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {doc.data && !swissLines?.length && (
                        <tr className="md:hidden">
                          <td colSpan={6} className="px-4 pb-3">
                            <div className="font-mono space-y-0.5 border border-cdlp-border rounded bg-cdlp-card/40 p-2">
                              <p className={`text-[10px] font-bold ${vatNeedsAttention ? 'text-amber-400' : 'text-blue-400'}`}>
                                TVA {vat.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className="text-[8px] text-cdlp-muted">
                                {vatNeedsAttention
                                  ? 'Warning: VAT 0.00 — file needs attention'
                                  : extractedRateLabel || 'Rate missing in source'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && doc.data && (
                        <tr onClick={(e) => e.stopPropagation()}>
                          <td colSpan={6} className="p-0 bg-cdlp-card border-t border-cdlp-border">
                            <VerificationHub
                              doc={doc}
                              onUpdate={(newData) => {
                                if ((doc as any).source === 'firestore') {
                                  updateDocument(firestoreRecordId(doc), { data: newData });
                                } else {
                                  setLocalDocs((prev) =>
                                    prev.map((d) => (d.id === doc.id ? { ...d, data: newData } : d))
                                  );
                                }
                              }}
                              onSave={async (newData) => {
                                if ((doc as any).source === 'firestore') {
                                  const recordId = firestoreRecordId(doc);
                                  // Update document in Firestore
                                  await updateDocument(recordId, { data: newData });
                                  
                                  // Update related income/expenses in dashboard
                                  if (onDocumentUpdated) {
                                    await onDocumentUpdated(recordId, newData);
                                  }
                                } else {
                                  setLocalDocs((prev) =>
                                    prev.map((d) => (d.id === doc.id ? { ...d, data: newData } : d))
                                  );
                                }
                                toggleRow(doc.id);
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-cdlp-border bg-cdlp-card flex justify-between items-center">
            <div className="text-[10px] font-bold text-cdlp-muted uppercase tracking-wider">
              {stats.completed} Documents Processed
            </div>
            <button 
              onClick={() => {
                const completedDocs = allDocs.filter(d => d.status === 'completed' && d.data);
                if (completedDocs.length === 0) {
                  alert('No completed documents to export');
                  return;
                }
                const dataToExport = completedDocs.map(d => d.data!);
                exportToExcel(dataToExport, 'Restaurant_Documents', reportingCurrency);
              }}
              disabled={stats.completed === 0}
              className="h-10 px-6 bg-cdlp-gold text-cdlp-black rounded font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 hover:bg-cdlp-gold-light disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export to Excel
            </button>
          </div>
        </div>
      )}
      <input
        ref={reattachInputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
        onChange={(e) => {
          void onReattachFileSelected(e.target.files);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
};
