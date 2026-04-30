import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, CheckCircle, Loader2, Trash2, 
  ChevronDown, ChevronRight, AlertTriangle, 
  ShieldCheck, Zap, Ban, FileSpreadsheet, XCircle,
  Edit3, RefreshCcw, Check, ListOrdered, Terminal,
  SearchCode, Cpu, Landmark, TerminalSquare, ExternalLink,
  ArrowUpRight, ArrowDownRight, Scale as ScaleIcon, Eye, Plus
} from 'lucide-react';
import { analyzeFinancialDocument } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { openDocumentInNewTab } from '../lib/openDocumentInNewTab';
import { detectCategory } from '../services/categoryDetectionService';
import { ProcessedDocument, BankTransaction, FinancialData, DocumentType, PaySlipAnalysis } from '../types';

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

// Verification Hub - Main editing interface
const VerificationHub: React.FC<{ 
  doc: ProcessedDocument; 
  onUpdate: (data: FinancialData) => void;
  onSave: (data: FinancialData) => void;
}> = ({ doc, onUpdate, onSave }) => {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [showSubInvoiceModal, setShowSubInvoiceModal] = useState(false);
  const hasViewableSource = Boolean(doc.fileUrl || doc.fileDataUrl || doc.fileRaw);

  const handleFieldChange = (field: keyof FinancialData, value: any) => {
    let newData = { ...doc.data!, [field]: value };
    
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
      if (newData.documentType === DocumentType.BANK_STATEMENT) {
        newData.totalAmount = totalIncome - totalExpense;
      } else {
        // For invoices, sum all amounts
        newData.totalAmount = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      }
      
      newData.amountInCHF = newData.totalAmount;
      
      console.log('📊 Line items changed - recalculated totals:', {
        totalIncome,
        totalExpense,
        totalAmount: newData.totalAmount
      });
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
  const isBankStatement = editedData.documentType === DocumentType.BANK_STATEMENT;
  const isPaySlip = editedData.documentType === DocumentType.PAY_SLIP;
  const isZeroValue = Number(editedData.totalAmount) === 0;
  const subDocuments = Array.isArray(editedData.subDocuments) ? editedData.subDocuments : [];
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
        <div className="flex-1 p-4 sm:p-6 md:p-10 flex flex-col bg-cdlp-black overflow-hidden">
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
                    <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">Issuer Entity</label>
                    <input value={editedData.issuer} onChange={e => handleFieldChange('issuer', e.target.value)} className="w-full h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-bold text-foreground outline-none focus:border-cdlp-gold transition-colors" />
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
                       <span>Total Amount {isZeroValue && <AlertTriangle className="w-3 h-3 inline ml-1 align-text-top" />}</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editedData.totalAmount} 
                        onChange={e => handleFieldChange('totalAmount', parseFloat(e.target.value) || 0)} 
                        className={`w-full h-11 px-4 rounded-sm text-xs font-black text-foreground outline-none transition-all ${isZeroValue ? 'bg-red-600/10 border-2 border-red-600' : 'bg-cdlp-card border border-cdlp-border'}`} 
                      />
                      {isZeroValue && (
                        <div className="absolute -bottom-5 left-0 text-[8px] font-black text-red-600 uppercase tracking-widest animate-pulse">Value cannot be zero</div>
                      )}
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[9px] font-black uppercase text-blue-600 tracking-[0.2em] block mb-2">VAT Amount</label>
                       <input 
                         type="number" 
                         step="0.01" 
                         value={editedData.vatAmount || 0} 
                         onChange={e => handleFieldChange('vatAmount', parseFloat(e.target.value) || 0)} 
                        className="w-full h-11 px-4 bg-blue-600/10 border border-blue-600/20 rounded-sm text-xs font-bold text-foreground outline-none focus:border-blue-600 transition-colors" 
                       />
                    </div>
                    <div>
                       <label className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.2em] block mb-2">Net Amount</label>
                       <input 
                         type="number" 
                         step="0.01" 
                         value={editedData.netAmount || 0} 
                         onChange={e => handleFieldChange('netAmount', parseFloat(e.target.value) || 0)} 
                        className="w-full h-11 px-4 bg-emerald-600/10 border border-emerald-600/20 rounded-sm text-xs font-bold text-foreground outline-none focus:border-emerald-600 transition-colors" 
                       />
                    </div>
                 </div>
              </div>
              <div className="space-y-5 md:col-span-2 xl:col-span-1">
                 <div>
                    <label className="text-[9px] font-black uppercase text-cdlp-muted tracking-[0.2em] block mb-2">Date</label>
                    <input type="date" value={editedData.date} onChange={e => handleFieldChange('date', e.target.value)} className="w-full h-11 px-4 bg-cdlp-card border border-cdlp-border rounded-sm text-xs font-bold text-foreground outline-none" />
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

           {/* Computed Totals Summary - Shows real-time calculation from line items */}
           {editedData.lineItems && editedData.lineItems.length > 0 && (
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
                     {(editedData.lineItems.filter(i => i.type === 'INCOME').reduce((s, i) => s + (Number(i.amount) || 0), 0)).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <p className="text-[8px] text-emerald-600/60">{editedData.originalCurrency || 'CHF'}</p>
                 </div>
                 <div className="bg-red-900/20 border border-red-600/30 rounded p-3">
                   <p className="text-[8px] font-black uppercase text-red-600 mb-1">Total Expenses</p>
                   <p className="text-lg font-black text-red-400">
                     {(editedData.lineItems.filter(i => i.type === 'EXPENSE').reduce((s, i) => s + (Number(i.amount) || 0), 0)).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <p className="text-[8px] text-red-600/60">{editedData.originalCurrency || 'CHF'}</p>
                 </div>
                 <div className="bg-cdlp-gold/20 border border-cdlp-gold/30 rounded p-3">
                   <p className="text-[8px] font-black uppercase text-cdlp-gold mb-1">Document Total</p>
                   <p className="text-lg font-black text-cdlp-gold">
                     {(editedData.totalAmount || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <p className="text-[8px] text-cdlp-gold/60">{editedData.originalCurrency || 'CHF'}</p>
                 </div>
               </div>
               <div className="mt-3 text-center">
                 <p className="text-[9px] text-cdlp-muted">
                   ℹ️ These totals update automatically as you edit line items. Click save button below to apply changes to dashboard.
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
           
           {/* Sticky Save Button - Improved with clear messaging */}
           <div className="sticky bottom-0 pt-6 pb-2 border-t-2 border-cdlp-gold/30 mt-6 bg-gradient-to-t from-cdlp-black via-cdlp-black to-transparent">
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
                className={`w-full h-16 rounded-lg font-black text-[11px] sm:text-[12px] uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 ${isZeroValue ? 'bg-cdlp-card text-cdlp-muted cursor-not-allowed border-red-600/20 border' : 'bg-gradient-to-r from-emerald-600 to-cdlp-gold text-white hover:from-emerald-500 hover:to-cdlp-gold-light animate-pulse'}`}
              >
                <ShieldCheck className="w-6 h-6" /> 
                <span>Save & Update Dashboard</span>
                <RefreshCcw className="w-5 h-5" />
              </button>
              <p className="text-center text-[9px] text-cdlp-gold mt-3 uppercase tracking-wider font-bold">
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
                  {subDocuments.map((subDoc: any, idx: number) => (
                    <tr key={`${subDoc.issuer || 'invoice'}-${idx}`} className="text-foreground">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2 font-semibold">{subDoc.issuer || `Invoice ${idx + 1}`}</td>
                      <td className="px-3 py-2">{subDoc.pageRange || '-'}</td>
                      <td className="px-3 py-2">{subDoc.date || '-'}</td>
                      <td className="px-3 py-2">{subDoc.expenseCategory || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {(Number(subDoc.totalAmount || 0)).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(Number(subDoc.netAmount || 0)).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(Number(subDoc.vatAmount || 0)).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
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

// Main Document Processor Component
export const DocumentProcessor: React.FC<{ 
  documents: ProcessedDocument[], 
  updateDocument: (documentId: string, updates: Partial<ProcessedDocument>) => Promise<void>,
  onDeleteDocument: (documentId: string) => Promise<void>,
  onDocumentQueued?: (fileName: string, fileHash?: string, fileRaw?: File) => Promise<string>,
  onDataExtracted: (data: any, fileName: string, fileHash?: string, fileRaw?: File, persistedDocumentId?: string) => void,
  onDocumentUpdated?: (documentId: string, newData: FinancialData) => Promise<void>
}> = ({ documents, updateDocument, onDeleteDocument, onDocumentQueued, onDataExtracted, onDocumentUpdated }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reportingCurrency] = useState('CHF');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<ProcessedDocument[]>([]);
  const stopProcessingRef = useRef(false);
  const dragCounter = useRef(0);

  // Large PDFs are slower with too much parallelism; keep modest concurrency for steadier throughput.
  const CONCURRENCY_LIMIT = 2;
  
  // Combine Firestore documents with local processing documents
  const allDocs = useMemo(() => {
    const firestoreDocs = documents.map(d => ({ ...d, source: 'firestore' as const }));
    const localProcessing = localDocs.filter(ld => !documents.some(d => d.fileName === ld.fileName));
    return [...firestoreDocs, ...localProcessing];
  }, [documents, localDocs]);

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

  const processDoc = async (doc: ProcessedDocument) => {
    setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'processing', error: undefined } : d));
    try {
      console.log(`Processing: ${doc.fileName}`);
      
      const res = await analyzeFinancialDocument(doc.fileRaw!, reportingCurrency);
      console.log(`✅ Completed: ${doc.fileName}`);
      
      setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'completed', data: res } : d));
      
      // Auto-extract data and save to Firestore with file metadata
      try {
        console.log(`💾 Saving document: ${doc.fileName}`);
        await onDataExtracted(res, doc.fileName, doc.fileHash, doc.fileRaw, doc.persistedDocumentId);
        console.log(`✅ Document saved successfully: ${doc.fileName}`);
      } catch (saveErr: any) {
        console.error(`❌ Failed to save document: ${doc.fileName}`, saveErr);
        // Mark as error but keep the analyzed data
        setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'error', error: `Failed to save: ${saveErr.message}` } : d));
      }
    } catch (err: any) {
      console.error(`❌ Error: ${doc.fileName}`, err);
      setLocalDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'error', error: err.message } : d));
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

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pending = localDocs.filter(d => d.status === 'pending' || d.status === 'error' || d.status === 'skipped');
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
                disabled={localDocs.filter(d => d.status === 'pending' || d.status === 'error' || d.status === 'skipped').length === 0} 
                className="w-full h-12 bg-cdlp-gold text-cdlp-black rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-30 hover:bg-cdlp-gold-light"
              >
                <ShieldCheck className="w-4 h-4" /> Start Processing ({localDocs.filter(d => d.status === 'pending' || d.status === 'error' || d.status === 'skipped').length})
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
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full text-xs">
              <thead className="bg-cdlp-gold text-cdlp-black uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Amount</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cdlp-border">
                {allDocs.map((doc) => {
                  const isExpanded = expandedRows.has(doc.id);
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
                                  try {
                                    if (doc.fileUrl) {
                                      const { deleteDocument: deleteStoredFile } = await import('../services/storageService');
                                      await deleteStoredFile(doc.fileUrl);
                                    }
                                  } catch (storageErr) {
                                    console.warn('Storage delete skipped/failed:', storageErr);
                                  }
                                  try {
                                    await onDeleteDocument(doc.id);
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
                      {isExpanded && doc.data && (
                        <tr onClick={(e) => e.stopPropagation()}>
                          <td colSpan={4} className="p-0 bg-cdlp-card border-t border-cdlp-border">
                            <VerificationHub
                              doc={doc}
                              onUpdate={(newData) => {
                                if ((doc as any).source === 'firestore') {
                                  updateDocument(doc.id, { data: newData });
                                } else {
                                  setLocalDocs((prev) =>
                                    prev.map((d) => (d.id === doc.id ? { ...d, data: newData } : d))
                                  );
                                }
                              }}
                              onSave={async (newData) => {
                                if ((doc as any).source === 'firestore') {
                                  // Update document in Firestore
                                  await updateDocument(doc.id, { data: newData });
                                  
                                  // Update related income/expenses in dashboard
                                  if (onDocumentUpdated) {
                                    await onDocumentUpdated(doc.id, newData);
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
    </div>
  );
};
