
import React, { useState, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProcessedDocument, DocumentType, BankTransaction, FinancialData } from '../types';
import { TAX_CATEGORIES } from './DocumentProcessor';
import { 
  MessageSquare, Sparkles, Send, Loader2, 
  X, Eye, AlertCircle, Camera, 
  FileText, Search, Maximize2, ShieldAlert,
  CheckCircle, ReceiptSwissFranc, ExternalLink,
  TrendingUp, TrendingDown, Landmark, PieChart,
  ArrowUpRight, ArrowDownRight, Target, 
  LayoutGrid, BarChart3, Activity, Tag
} from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

interface FinancialInsightsProps {
  documents: ProcessedDocument[];
}

// Function to render text with clickable links for better AI interaction and audit transparency.
const renderMessageWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
          {part} <ExternalLink className="w-3 h-3" />
        </a>
      );
    }
    return part;
  });
};

const EvidenceModal: React.FC<{ doc: ProcessedDocument; onClose: () => void }> = ({ doc, onClose }) => {
  const [docUrl, setDocUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (doc.fileRaw) {
      const url = URL.createObjectURL(doc.fileRaw);
      setDocUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [doc]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ypsom-shadow/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-sm flex flex-col shadow-2xl border border-ypsom-alice overflow-hidden">
        <div className="px-8 py-5 bg-ypsom-deep text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="p-2.5 bg-white/10 rounded-sm shadow-inner"><FileText className="w-6 h-6" /></div>
             <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">Audit Evidence Metadata</p>
                <h3 className="text-base font-bold truncate max-w-md">{doc.fileName}</h3>
             </div>
          </div>
          <div className="flex items-center gap-3">
             {docUrl && (
               <a href={docUrl} target="_blank" rel="noreferrer" className="p-3 hover:bg-white/10 rounded-sm transition-all" title="Open Trace in New Tab">
                 <ExternalLink className="w-6 h-6" />
               </a>
             )}
             <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-sm transition-all">
               <X className="w-6 h-6" />
             </button>
          </div>
        </div>
        
        <div className="p-10 space-y-8 bg-white">
             <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate mb-6 border-b border-ypsom-alice pb-3">Metadonnees de controle</h4>
                <div className="space-y-5">
                   <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-ypsom-slate uppercase tracking-tight">Classification</span>
                      <span className="text-[11px] font-black uppercase text-ypsom-deep bg-ypsom-alice/30 px-3 py-1 rounded-sm">{doc.data?.documentType}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-ypsom-slate uppercase tracking-tight">Fiscal Date</span>
                      <span className="text-[11px] font-mono font-black text-ypsom-deep">{doc.data?.date || 'N/A'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-ypsom-slate uppercase tracking-tight">Gross Value</span>
                      <span className="text-[13px] font-mono font-black text-ypsom-deep border-b-2 border-ypsom-alice">
                        {doc.data?.amountInCHF.toLocaleString(undefined, { minimumFractionDigits: 2 })} CHF
                      </span>
                   </div>
                </div>
             </div>

             {doc.data?.forensicAlerts?.length ? (
               <div className="p-6 bg-amber-50 border border-amber-200 rounded-sm shadow-sm">
                  <div className="flex items-center gap-3 mb-3 text-amber-700">
                    <ShieldAlert className="w-5 h-5" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Compliance Alerts</span>
                  </div>
                  <ul className="text-[12px] text-amber-800 space-y-2.5 font-medium leading-relaxed">
                    {doc.data.forensicAlerts.map((a, i) => <li key={i} className="flex gap-2"><span>•</span>{a}</li>)}
                  </ul>
               </div>
             ) : (
               <div className="p-6 bg-green-50 border border-green-200 rounded-sm shadow-sm">
                  <div className="flex items-center gap-3 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Audit integrity Valid</span>
                  </div>
               </div>
             )}

             <div className="pt-6 border-t border-ypsom-alice">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate mb-3">AI Interpretation Note</h4>
                <p className="text-xs text-ypsom-deep italic leading-relaxed bg-ypsom-alice/10 p-4 rounded-sm border border-ypsom-alice/50">
                  {doc.data?.aiInterpretation || "No diagnostic interpretation trace recorded for this audit asset."}
                </p>
             </div>
             
             <button onClick={onClose} className="w-full py-4 bg-ypsom-deep text-white font-black text-[11px] uppercase tracking-widest rounded-sm">Close Record</button>
        </div>
      </div>
    </div>
  );
};

export const FinancialInsights: React.FC<FinancialInsightsProps> = ({ documents }) => {
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string; image?: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ProcessedDocument | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const completedDocs = documents.filter(d => d.status === 'completed' && d.data);
    
    const flattenedItems: Array<{ 
      id: string; 
      issuer: string; 
      amount: number; 
      category: string; 
      parentDoc: ProcessedDocument; 
      type: string;
      date: string;
    }> = [];

    completedDocs.forEach(d => {
      if (d.data?.subDocuments && d.data.subDocuments.length > 0) {
        d.data.subDocuments.forEach((sub, idx) => {
          flattenedItems.push({
            id: `${d.id}_sub_${idx}`,
            issuer: sub.issuer || 'Unknown Entity',
            amount: sub.amountInCHF || sub.totalAmount || 0,
            category: sub.expenseCategory || d.data?.expenseCategory || 'Bank',
            parentDoc: d,
            type: sub.documentType || 'VOUCHER',
            date: sub.date || d.data?.date || ''
          });
        });
      } else if (d.data) {
        flattenedItems.push({
          id: d.id,
          issuer: d.data.issuer || 'Unknown Entity',
          amount: d.data.amountInCHF || d.data.totalAmount || 0,
          category: d.data.expenseCategory || 'Bank',
          parentDoc: d,
          type: d.data.documentType,
          date: d.data.date
        });
      }
    });

    const isRevenueCategory = (category: string) => {
      const c = (category || '').toLowerCase();
      // Business rule:
      // - Entree d'argent = ventes du restaurant + reservations
      // - Sortie d'argent = factures, salaires/cotisations sociales, fournisseurs, etc.
      // We classify revenues by category keywords coming from the AI.
      return (
        c.includes('restaurant') ||
        c.includes('reservation') ||
        c.includes('booking') ||
        c.includes('depot') || // may appear in French bank/ATM labels
        c.includes('bank deposit') ||
        c.includes('caisse')
      );
    };

    const income = flattenedItems.reduce((s, d) => s + (isRevenueCategory(d.category) ? d.amount : 0), 0);
    const expense = flattenedItems.reduce((s, d) => s + (!isRevenueCategory(d.category) ? d.amount : 0), 0);
    
    const byCategory: Record<string, { total: number, items: typeof flattenedItems }> = {};

    flattenedItems.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, items: [] };
      }
      byCategory[cat].total += item.amount;
      byCategory[cat].items.push(item);
    });
    
    return { income, expense, net: income - expense, byCategory, flattenedItems };
  }, [documents]);

  // Explicit type assertion to fix property access errors on sorted entries
  const sortedCategories = useMemo(() => {
     return (Object.entries(stats.byCategory) as [string, { total: number; items: any[] }][])
       .sort((a, b) => b[1].total - a[1].total);
  }, [stats.byCategory]);

  const maxVal = sortedCategories[0]?.[1].total || 1;

  const handleQuery = async () => {
    if ((!query.trim() && !selectedImage) || isAsking) return;
    const userMsg = query;
    const currentImage = selectedImage;
    const currentPreview = previewUrl;
    setQuery('');
    setSelectedImage(null);
    setPreviewUrl(null);
    
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg || "[Audit Vision Scan]", image: currentPreview || undefined }]);
    setIsAsking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = JSON.stringify(stats.flattenedItems.map(item => ({ 
        issuer: item.issuer, 
        total: item.amount, 
        category: item.category, 
        parentFile: item.parentDoc.fileName,
        date: item.date
      })));
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: 'user', parts: [{ text: `Audit Intelligent Ledger Context: ${context}. User Inquiry: ${userMsg || "Scan dataset"}` }] }
        ],
        config: { systemInstruction: "Forensic auditor mode. Support custom user categories. Reference specific tickets by entity name." }
      });
      setChatHistory(prev => [...prev, { role: 'model', text: response.text || "Failed." }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'model', text: `Diagnostic Error: ${err.message}` }]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 h-[calc(100vh-250px)] animate-in fade-in duration-500">
      {previewDoc && <EvidenceModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-sm border border-ypsom-alice shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-sm"><TrendingUp className="w-4 h-4" /></div>
                <span className="text-[10px] font-black uppercase text-ypsom-slate tracking-widest">Entree d'argent</span>
             </div>
             <p className="text-xl font-black text-ypsom-deep font-mono leading-none">
               {stats.income.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs opacity-40">CHF</span>
             </p>
          </div>
          <div className="bg-white p-6 rounded-sm border border-ypsom-alice shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 text-red-600 rounded-sm"><TrendingDown className="w-4 h-4" /></div>
                <span className="text-[10px] font-black uppercase text-ypsom-slate tracking-widest">Sortie d'argent</span>
             </div>
             <p className="text-xl font-black text-ypsom-deep font-mono leading-none">
               {stats.expense.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs opacity-40">CHF</span>
             </p>
          </div>
          <div className="bg-white p-6 rounded-sm border border-ypsom-alice shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-sm"><Target className="w-4 h-4" /></div>
                <span className="text-[10px] font-black uppercase text-ypsom-slate tracking-widest">Audit Line Count</span>
             </div>
             <p className="text-xl font-black text-ypsom-deep font-mono leading-none">{stats.flattenedItems.length}<span className="text-xs opacity-40"> ASSETS</span></p>
          </div>
          <div className="bg-ypsom-deep p-6 rounded-sm shadow-xl flex flex-col justify-between">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 text-white rounded-sm"><Activity className="w-4 h-4" /></div>
                <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Reconciliation Status</span>
             </div>
             <p className="text-xl font-black text-white font-mono leading-none">CERTIFIED</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 flex-1 min-h-0">
        <div className="lg:col-span-1 space-y-8 overflow-y-auto pr-3 custom-scrollbar h-full">
          <div className="bg-white p-8 rounded-sm border border-ypsom-alice shadow-md">
             <div className="flex items-center justify-between mb-8 border-b border-ypsom-alice pb-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-ypsom-deep">Dynamic Distribution</h3>
                <BarChart3 className="w-4 h-4 text-ypsom-slate opacity-20" />
             </div>
             <div className="space-y-6">
                {sortedCategories.map(([catName, data]) => {
    const catConfig = TAX_CATEGORIES.find(c => c.id === catName || c.label === catName);
                  const isExpanded = expandedCat === catName;
                  return (
                    <div key={catName} className="space-y-3">
                       <button 
                         onClick={() => setExpandedCat(isExpanded ? null : catName)}
                         className="w-full text-left group"
                       >
                         <div className="flex justify-between items-end mb-2">
                            <span className="text-[12px] font-black text-ypsom-deep uppercase tracking-tighter group-hover:text-ypsom-shadow transition-colors truncate max-w-[150px]">{catName}</span>
                            <span className="text-[11px] font-black text-ypsom-deep font-mono">
                              {data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                         </div>
                         <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner flex">
                            <div 
                              className={`h-full ${catConfig?.color.replace('text', 'bg') || 'bg-slate-500'} transition-all duration-700 ease-out`} 
                              style={{ width: `${(data.total / maxVal) * 100}%` }} 
                            />
                         </div>
                       </button>

                       {isExpanded && (
                         <div className="pl-4 border-l-2 border-ypsom-alice space-y-2 animate-in slide-in-from-top-2 duration-300 mt-3">
                            {data.items.map(item => (
                              <div 
                                key={item.id}
                                onClick={() => setPreviewDoc(item.parentDoc)}
                                className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-sm cursor-pointer border border-transparent hover:border-ypsom-alice transition-all shadow-sm bg-white/40 group/item"
                              >
                                 <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold text-ypsom-slate uppercase truncate group-hover/item:text-ypsom-deep">{item.issuer}</span>
                                    <span className="text-[7px] text-ypsom-slate/30 uppercase font-black">{item.parentDoc.fileName}</span>
                                 </div>
                                 <div className="flex flex-col items-end shrink-0 ml-4">
                                    <span className="text-[10px] font-black text-ypsom-deep font-mono">{(item.amount || 0).toFixed(2)}</span>
                                    <span className="text-[7px] text-ypsom-slate/40 uppercase font-black">{item.date}</span>
                                 </div>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                  );
                })}
             </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col bg-white rounded-sm border border-ypsom-alice shadow-2xl overflow-hidden h-full">
          <div className="p-6 bg-gray-50 border-b border-ypsom-alice flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="p-2.5 bg-ypsom-deep rounded-sm shadow-lg"><Sparkles className="w-5 h-5 text-white" /></div>
               <div>
                  <h3 className="text-[12px] font-black uppercase tracking-widest text-ypsom-deep">Forensic Neural Hub</h3>
                  <p className="text-[9px] font-bold text-ypsom-slate uppercase tracking-[0.2em] mt-0.5">Integration des donnees</p>
               </div>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-white border border-ypsom-alice rounded-sm shadow-sm">
                <Tag className="w-3 h-3 text-ypsom-slate opacity-40" />
                <span className="text-[9px] font-black text-ypsom-slate uppercase tracking-tighter">Support Custom Taxonomy</span>
             </div>
          </div>
          
          <div className="flex-1 p-10 overflow-y-auto space-y-12 custom-scrollbar bg-gray-50/10">
             {chatHistory.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                  <div className="w-20 h-20 bg-ypsom-alice/30 rounded-full flex items-center justify-center mb-6">
                    <MessageSquare className="w-10 h-10 text-ypsom-deep" />
                  </div>
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-ypsom-deep mb-2">Neural Engine Initialized</h4>
                  <p className="text-[10px] font-bold uppercase text-ypsom-slate">Inquire about anomalies, categories, or audit reconciliation</p>
               </div>
             )}
             {chatHistory.map((msg, i) => (
               <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-7 rounded-sm shadow-xl relative ${msg.role === 'user' ? 'bg-ypsom-deep text-white' : 'bg-white border border-ypsom-alice text-ypsom-deep'}`}>
                     {msg.image && <img src={msg.image} className="mb-6 max-h-72 rounded-sm border border-black/10 shadow-lg" />}
                     <div className="text-[15px] leading-relaxed font-medium">
                        {msg.role === 'model' ? (
                           <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-strong:text-ypsom-deep">
                              {renderMessageWithLinks(msg.text)}
                           </div>
                        ) : msg.text}
                     </div>
                  </div>
               </div>
             ))}
             {isAsking && <div className="p-5 bg-white border border-ypsom-alice rounded-sm inline-flex items-center gap-4 animate-pulse shadow-md"><Loader2 className="w-5 h-5 animate-spin text-ypsom-deep" /><span className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate">Execution de l'analyse...</span></div>}
          </div>

          <div className="p-8 bg-white border-t border-ypsom-alice">
             <div className="flex items-center gap-5">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="h-14 w-14 bg-gray-50 rounded-sm flex items-center justify-center border border-ypsom-alice hover:bg-ypsom-alice hover:text-ypsom-deep transition-all shadow-sm shrink-0"
                >
                  <Camera className="w-6 h-6" />
                </button>
                <input type="file" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]) { setSelectedImage(e.target.files[0]); setPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="hidden" accept="image/*" />
                <div className="flex-1 relative group">
                  <input 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                    placeholder="Interrogate audited dataset or visual evidence..."
                    className="w-full h-14 pl-7 pr-16 bg-gray-50 border border-ypsom-alice rounded-sm text-sm font-medium focus:border-ypsom-deep focus:ring-4 focus:ring-ypsom-deep/5 outline-none shadow-inner transition-all"
                  />
                  <button onClick={handleQuery} className="absolute right-2.5 top-2.5 bottom-2.5 w-11 bg-ypsom-deep text-white rounded-sm flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
