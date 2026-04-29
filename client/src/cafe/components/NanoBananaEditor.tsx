import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Camera, Search, Loader2, FileSearch, Sparkles, X, Eye, AlertCircle, RefreshCw, Zap, Layers } from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

export const NanoBananaEditor: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isZ2Mode, setIsZ2Mode] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('Analyze this financial document for any signs of tampering or handwritten notes. Extract the handwritten text specifically if found.');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setAnalysisResult(null);
    }
  };

  const runVisualAudit = async () => {
    if (!selectedImage || isAnalyzing) return;
    setIsAnalyzing(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64 = await fileToBase64(selectedImage);
      
      const z2Prompt = `Perform a Z2 Bulk Forensic Analysis on this image containing multiple tickets/receipts. 
      1. Identify and count all distinct documents visible in this batch.
      2. For each identified document:
         - Extract Issuer Name, Date, and Total Amount.
         - Classify as 'Invoice' or 'Receipt'.
         - EXTRACT A DETAILED BREAKDOWN OF LINE ITEMS (item description, quantity, price).
      3. Flag any visual inconsistencies, blurs, or potential handwritten tampering.
      4. Provide a total audit sum for the entire image.
      Format the output using clear Markdown tables for each document's line items and a summary section at the end.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
          parts: [
            { inlineData: { mimeType: selectedImage.type, data: base64 } },
            { text: isZ2Mode ? z2Prompt : customPrompt }
          ]
        }
      });

      setAnalysisResult(response.text || "No insights extracted from visual analysis.");
    } catch (err: any) {
      setAnalysisResult(`Visual Forensic Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="bg-white p-8 rounded-sm shadow-sm border border-ypsom-alice">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-ypsom-deep rounded-sm shadow-lg">
                 <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h2 className="text-xl font-black text-ypsom-deep uppercase tracking-widest">Visual forensic Intelligence</h2>
                 <p className="text-[11px] font-bold text-ypsom-slate uppercase tracking-widest opacity-60">Nano Banana Vision v4.0</p>
              </div>
           </div>

           <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-sm border border-ypsom-alice">
              <button 
                onClick={() => { setIsZ2Mode(false); setAnalysisResult(null); }}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${!isZ2Mode ? 'bg-white text-ypsom-deep shadow-sm' : 'text-ypsom-slate'}`}
              >
                Single Forensic
              </button>
              <button 
                onClick={() => { setIsZ2Mode(true); setAnalysisResult(null); }}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-2 ${isZ2Mode ? 'bg-amber-600 text-white shadow-md' : 'text-ypsom-slate'}`}
              >
                <Layers className="w-3 h-3" /> Z2 Bulk Multi-Ticket
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
             {!previewUrl ? (
               <label className="flex flex-col items-center justify-center h-[450px] border-2 border-dashed border-ypsom-alice hover:bg-gray-50 rounded-sm cursor-pointer transition-all group">
                  <Camera className="w-12 h-12 text-ypsom-slate mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ypsom-slate text-center px-8">
                    {isZ2Mode ? 'Upload Multi-Ticket Sheet for Z2 Line-Item Analysis' : 'Upload Evidence for Forensic Scan'}
                  </p>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
               </label>
             ) : (
               <div className="relative h-[450px] bg-black/5 rounded-sm border border-ypsom-alice overflow-hidden group shadow-inner">
                  <img src={previewUrl} className="w-full h-full object-contain" alt="Evidence Preview" />
                  <button 
                    onClick={() => { setSelectedImage(null); setPreviewUrl(null); setAnalysisResult(null); }}
                    className="absolute top-4 right-4 p-2 bg-white/90 shadow-lg rounded-sm hover:text-red-600 transition-colors border border-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                     <p className="text-[9px] text-white font-black uppercase tracking-widest">{selectedImage?.name}</p>
                     {isZ2Mode && <p className="text-[8px] text-amber-400 font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5"><Zap className="w-3 h-3" /> Z2 MULTI-TICKET FORENSIC ENGINE ACTIVE</p>}
                  </div>
               </div>
             )}
          </div>

          <div className="flex flex-col h-full">
             {!isZ2Mode && (
               <div className="mb-6">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-ypsom-slate mb-2">Audit Objective</label>
                  <textarea 
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full h-32 bg-gray-50 border border-ypsom-alice rounded-sm p-4 text-xs font-medium text-ypsom-deep focus:outline-none focus:ring-1 focus:ring-ypsom-deep resize-none shadow-inner"
                    placeholder="Ask about specific handwritten notes, logos, or tampering signs..."
                  />
               </div>
             )}

             <button 
               onClick={runVisualAudit}
               disabled={!selectedImage || isAnalyzing}
               className={`w-full h-14 ${isZ2Mode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-ypsom-deep hover:bg-ypsom-shadow'} text-white rounded-sm font-black text-[11px] uppercase tracking-[0.2em] shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-3 mb-6`}
             >
               {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               {isZ2Mode ? 'Execute Z2 Line-Item Analysis' : 'Run Visual Forensic Diagnostic'}
             </button>

             <div className="flex-1 bg-white border border-ypsom-alice rounded-sm p-6 overflow-y-auto min-h-[250px] shadow-inner relative prose prose-sm prose-slate max-w-none">
                {!analysisResult && !isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 prose-none">
                    <FileSearch className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Visual Input</p>
                  </div>
                ) : isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 prose-none">
                    <RefreshCw className="w-6 h-6 animate-spin text-ypsom-deep" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate animate-pulse">Engaging Nano Banana Vision Engine...</p>
                    {isZ2Mode && <p className="text-[9px] text-amber-600 font-black uppercase">Parsing Document Layers & Line Items</p>}
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-6 border-b border-ypsom-alice pb-3 not-prose">
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-ypsom-slate">Forensic Summary Generated</span>
                       </div>
                       {isZ2Mode && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Z2 Multi-Ticket Output</span>}
                    </div>
                    <div className="text-sm font-medium text-ypsom-deep leading-relaxed whitespace-pre-wrap">
                      {analysisResult}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};