import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader, CheckCircle, XCircle, Play, StopCircle, Trash2 } from 'lucide-react';
import { resolveDocumentProcessingTimeoutMs } from '../lib/documentProcessingTimeout';
import { analyzeFinancialDocument } from '../services/geminiService';
import { enrichFinancialDataWithSwissAccount } from '../services/swissAccountClassifierService';
import { formatDocumentProcessError } from '../lib/documentProcessError';
import { resolveDocumentBatchSize, runInDocumentBatches } from '../lib/runDocumentBatches';
import { useSubscription } from '../context/SubscriptionContext';
import { BUSINESS_DOCUMENT_ACCEPT, isBusinessDocumentFile } from '../lib/businessDocumentFile';
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
  const { billing } = useSubscription();
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState<'parallel' | 'sequential'>('parallel');
  const [pageLimitNotice, setPageLimitNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const stopProcessingRef = useRef(false);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        uploadTitle: 'Upload Documents',
        uploadDesc: 'Drag & drop invoices, receipts, bank statements, or CSV (PDF, JPG, PNG, CSV)',
        browse: 'Browse Files',
        processing: 'Processing',
        completed: 'Completed',
        error: 'Error',
        pending: 'Pending',
        startProcessing: 'Start Processing',
        stopProcessing: 'Stop Processing',
        clearAll: 'Clear All',
        pageLimitBanner: '{count} PDF(s) exceed {max} pages and were not processed: {names}',
      },
      fr: {
        uploadTitle: 'Télécharger des documents',
        uploadDesc: 'Glissez-déposez factures, reçus, relevés ou CSV (PDF, JPG, PNG, CSV)',
        browse: 'Parcourir',
        processing: 'Traitement',
        completed: 'Terminé',
        error: 'Erreur',
        pending: 'En attente',
        startProcessing: 'Démarrer le traitement',
        stopProcessing: 'Arrêter',
        clearAll: 'Tout effacer',
        pageLimitBanner: '{count} PDF dépasse(nt) {max} pages et n’ont pas été traités : {names}',
      },
    };
    return translations[language][key] || key;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    const incoming = Array.from(fileList).filter((file) => isBusinessDocumentFile(file));
    const overLimit: string[] = [];
    let pdfHelpers: typeof import('../lib/pdfPagesToImages') | null = null;
    try {
      pdfHelpers = await import('../lib/pdfPagesToImages');
    } catch {
      pdfHelpers = null;
    }

    const newFiles: ProcessingFile[] = [];
    for (const file of incoming) {
      if (pdfHelpers?.isPdfFile(file)) {
        try {
          const pages = await pdfHelpers.getPdfPageCount(file);
          if (pdfHelpers.pdfPageLimitExceeded(pages)) {
            overLimit.push(file.name);
            newFiles.push({
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              file,
              status: 'error',
              error: formatDocumentProcessError(
                (key) => {
                  if (key === 'dpErrPageLimit') {
                    return language === 'fr'
                      ? 'Ce PDF a {pages} pages. Le maximum est {max}. Découpez-le en fichiers plus petits, puis téléversez à nouveau.'
                      : 'This PDF has {pages} pages. Maximum is {max}. Split it into smaller files, then upload again.';
                  }
                  return t(key);
                },
                'page_limit',
                pdfHelpers.pdfPageLimitMessage(pages)
              ),
            });
            continue;
          }
        } catch {
          /* process later */
        }
      }
      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        file,
        status: 'pending',
      });
    }

    if (overLimit.length > 0) {
      setPageLimitNotice(
        t('pageLimitBanner')
          .replace('{count}', String(overLimit.length))
          .replace('{max}', '7')
          .replace('{names}', overLimit.join(', '))
      );
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const processFiles = async () => {
    stopProcessingRef.current = false;
    setIsProcessing(true);

    const pendingFiles = files.filter(f => f.status === 'pending');
    console.log(`Starting ${processingMode} processing of ${pendingFiles.length} files...`);

    if (processingMode === 'sequential') {
      for (const fileItem of pendingFiles) {
        if (stopProcessingRef.current) break;
        await processFile(fileItem);
      }
    } else {
      await runInDocumentBatches(
        pendingFiles,
        resolveDocumentBatchSize(),
        () => stopProcessingRef.current,
        (item) => processFile(item)
      );
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
      
      const forceDeepPdfReads = billing?.deepPdfInvoiceBeta === true;
      let pdfPageCount = 1;
      let pdfPageSplit = false;
      try {
        const {
          getPdfPageCount,
          shouldSplitPdfToPageImages,
          looksLikeMultiTicketPdf,
        } = await import('../lib/pdfPagesToImages');
        const ticketLike = looksLikeMultiTicketPdf(fileItem.file);
        try {
          pdfPageCount = await getPdfPageCount(fileItem.file);
          pdfPageSplit = shouldSplitPdfToPageImages(fileItem.file, pdfPageCount);
          const { pdfPageLimitExceeded, pdfPageLimitMessage } = await import('../lib/pdfPagesToImages');
          if (pdfPageLimitExceeded(pdfPageCount)) {
            throw new Error(pdfPageLimitMessage(pdfPageCount));
          }
        } catch (peekErr) {
          if (peekErr instanceof Error && /PDF_PAGE_LIMIT/i.test(peekErr.message)) throw peekErr;
          console.warn('⚠️ PDF page-count peek failed:', peekErr);
          pdfPageSplit = ticketLike;
          pdfPageCount = ticketLike ? 5 : 1;
        }
        if (ticketLike && pdfPageCount >= 2) pdfPageSplit = true;
      } catch {
        /* best-effort */
      }
      const timeoutMs = resolveDocumentProcessingTimeoutMs(fileItem.file, {
        forceDeepPdfReads,
        pdfPageCount,
        pdfPageSplit,
      });
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

      let data = (await Promise.race([
        analyzeFinancialDocument(
          fileItem.file,
          'CHF',
          undefined,
          undefined,
          abortController.signal,
          { forceDeepPdfReads, forcePdfPageSplit: pdfPageSplit, pdfPageCount }
        ),
        timeoutPromise,
      ])) as any;
      try {
        data = await enrichFinancialDataWithSwissAccount(data, abortController.signal);
      } catch {
        /* classification optional */
      }
      
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
      const shown = /PDF_PAGE_LIMIT/i.test(errorMsg)
        ? formatDocumentProcessError(
            (key) => {
              if (key === 'dpErrPageLimit') {
                return language === 'fr'
                  ? 'Ce PDF a {pages} pages. Le maximum est {max}. Découpez-le en fichiers plus petits, puis téléversez à nouveau.'
                  : 'This PDF has {pages} pages. Maximum is {max}. Split it into smaller files, then upload again.';
              }
              return t(key);
            },
            'page_limit',
            errorMsg
          )
        : errorMsg;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'error' as const, error: shown }
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
      {pageLimitNotice && (
        <div className="mb-3 p-3 bg-red-600/10 border border-red-600 text-red-400 text-xs font-bold rounded">
          {pageLimitNotice}
        </div>
      )}
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
          accept={BUSINESS_DOCUMENT_ACCEPT}
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

