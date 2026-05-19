import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader, CheckCircle, XCircle, Play, StopCircle, Trash2 } from 'lucide-react';
import { resolveDocumentProcessingTimeoutMs } from '../lib/documentProcessingTimeout';
import { analyzeFinancialDocument } from '../services/geminiService';
import type { FinancialData } from '../types';

type ProcessingFile = {
  id: string;
  name: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: FinancialData;
  error?: string;
};

type QuickDocumentUploadProps = {
  onDataExtracted: (data: FinancialData, fileName: string) => void;
  language: 'en' | 'fr';
};

export function QuickDocumentUpload({ onDataExtracted, language }: QuickDocumentUploadProps) {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState<'parallel' | 'sequential'>('sequential');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const stopProcessingRef = useRef(false);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        uploadTitle: 'Upload Documents',
        uploadDesc: 'Drag & drop invoices, receipts, or bank statements (PDF, JPG, PNG)',
        browse: 'Browse Files',
        processing: 'Processing',
        completed: 'Completed',
        error: 'Error',
        pending: 'Pending',
        startProcessing: 'Start Processing',
        stopProcessing: 'Stop Processing',
        clearAll: 'Clear All',
      },
      fr: {
        uploadTitle: 'Télécharger des documents',
        uploadDesc: 'Glissez-déposez des factures, reçus ou relevés bancaires (PDF, JPG, PNG)',
        browse: 'Parcourir',
        processing: 'Traitement',
        completed: 'Terminé',
        error: 'Erreur',
        pending: 'En attente',
        startProcessing: 'Démarrer le traitement',
        stopProcessing: 'Arrêter',
        clearAll: 'Tout effacer',
      },
    };
    return translations[language][key] || key;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: ProcessingFile[] = Array.from(fileList)
      .filter(file => {
        // Only accept PDF and images
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        return validTypes.includes(file.type);
      })
      .map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        file,
        status: 'pending' as const,
      }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const processFiles = async () => {
    stopProcessingRef.current = false;
    setIsProcessing(true);

    const pendingFiles = files.filter(f => f.status === 'pending');
    console.log(`Starting ${processingMode} processing of ${pendingFiles.length} files...`);

    if (processingMode === 'sequential') {
      // Process one by one to avoid rate limits
      for (const fileItem of pendingFiles) {
        if (stopProcessingRef.current) break;
        await processFile(fileItem);
      }
    } else {
      // Process all in parallel
      const processingPromises = pendingFiles.map(fileItem => processFile(fileItem));
      await Promise.allSettled(processingPromises);
    }

    console.log('Processing complete!');
    setIsProcessing(false);
  };

  const processFile = async (fileItem: ProcessingFile) => {
    if (stopProcessingRef.current) return;

    console.log(`Processing: ${fileItem.name}`);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileItem.id ? { ...f, status: 'processing' as const } : f
      )
    );

    try {
      console.log(`Calling Gemini AI for: ${fileItem.name}`);
      
      const timeoutMs = resolveDocumentProcessingTimeoutMs(fileItem.file);
      const timeoutSec = Math.round(timeoutMs / 1000);
      const abortController = new AbortController();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          abortController.abort();
          reject(
            new Error(`Processing timeout (${timeoutSec}s). Retry or set VITE_DOCUMENT_PROCESSING_TIMEOUT_MS.`)
          );
        }, timeoutMs)
      );

      const data = (await Promise.race([
        analyzeFinancialDocument(fileItem.file, 'CHF', undefined, undefined, abortController.signal),
        timeoutPromise,
      ])) as any;
      
      console.log(`✅ AI analysis complete for: ${fileItem.name}`);
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'completed' as const, data } : f
        )
      );

      // Automatically extract and categorize
      console.log(`Extracting data from: ${fileItem.name}`);
      await onDataExtracted(data, fileItem.name);
      console.log(`✅ Data extracted successfully for: ${fileItem.name}`);
    } catch (error) {
      console.error(`❌ Error processing ${fileItem.name}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'error' as const, error: errorMsg }
            : f
        )
      );
    }
  };

  const stopProcessing = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const clearAll = () => {
    setFiles([]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div className="bg-cdlp-black border border-cdlp-border p-4 md:p-6 rounded-lg shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base md:text-lg font-black text-cdlp-gold uppercase">
          {t('uploadTitle')}
        </h2>
        <div className="flex gap-2">
          {files.length > 0 && (
            <button
              onClick={clearAll}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase text-red-400 border border-red-400 rounded hover:bg-red-400/10 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> {t('clearAll')}
            </button>
          )}
          {pendingCount > 0 && !isProcessing && (
            <button
              onClick={processFiles}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700"
            >
              <Play className="w-3 h-3" /> {t('startProcessing')} ({pendingCount})
            </button>
          )}
          {isProcessing && (
            <button
              onClick={stopProcessing}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700"
            >
              <StopCircle className="w-3 h-3" /> {t('stopProcessing')}
            </button>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-cdlp-gold bg-cdlp-gold/5' : 'border-cdlp-border hover:border-cdlp-gold hover:bg-cdlp-card'}
        `}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-cdlp-muted" />
        <p className="text-sm text-cdlp-gold font-bold mb-1">{t('uploadDesc')}</p>
        <button
          type="button"
          className="text-xs text-cdlp-gold underline hover:no-underline"
        >
          {t('browse')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Processing Status */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-cdlp-card border border-cdlp-border rounded"
            >
              <FileText className="w-4 h-4 text-cdlp-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-cdlp-muted">
                  {file.status === 'pending' && t('pending')}
                  {file.status === 'processing' && t('processing')}
                  {file.status === 'completed' && t('completed')}
                  {file.status === 'error' && `${t('error')}: ${file.error}`}
                </p>
              </div>
              {file.status === 'processing' && (
                <Loader className="w-4 h-4 text-cdlp-gold animate-spin flex-shrink-0" />
              )}
              {file.status === 'completed' && (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              )}
              {file.status === 'error' && (
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
              {(file.status === 'pending' || file.status === 'error') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="text-red-400 hover:text-red-500"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

