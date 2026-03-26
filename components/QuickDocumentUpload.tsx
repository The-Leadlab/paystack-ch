import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader, CheckCircle, XCircle, Play, StopCircle, Trash2 } from 'lucide-react';
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

    for (const fileItem of pendingFiles) {
      if (stopProcessingRef.current) break;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'processing' as const } : f
        )
      );

      try {
        const data = await analyzeFinancialDocument(fileItem.file, 'CHF');
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id ? { ...f, status: 'completed' as const, data } : f
          )
        );

        // Automatically extract and categorize
        onDataExtracted(data, fileItem.name);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'error' as const, error: errorMsg }
              : f
          )
        );
      }
    }

    setIsProcessing(false);
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
    <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base md:text-lg font-black text-ypsom-deep uppercase">
          {t('uploadTitle')}
        </h2>
        <div className="flex gap-2">
          {files.length > 0 && (
            <button
              onClick={clearAll}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase text-red-600 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> {t('clearAll')}
            </button>
          )}
          {pendingCount > 0 && !isProcessing && (
            <button
              onClick={processFiles}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700"
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
          ${isDragging ? 'border-ypsom-deep bg-ypsom-deep/5' : 'border-gray-300 hover:border-ypsom-deep hover:bg-gray-50'}
        `}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-ypsom-slate" />
        <p className="text-sm text-ypsom-deep font-bold mb-1">{t('uploadDesc')}</p>
        <button
          type="button"
          className="text-xs text-ypsom-deep underline hover:no-underline"
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
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
            >
              <FileText className="w-4 h-4 text-ypsom-slate flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-ypsom-deep truncate">{file.name}</p>
                <p className="text-[10px] text-ypsom-slate">
                  {file.status === 'pending' && t('pending')}
                  {file.status === 'processing' && t('processing')}
                  {file.status === 'completed' && t('completed')}
                  {file.status === 'error' && `${t('error')}: ${file.error}`}
                </p>
              </div>
              {file.status === 'processing' && (
                <Loader className="w-4 h-4 text-ypsom-deep animate-spin flex-shrink-0" />
              )}
              {file.status === 'completed' && (
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
              {file.status === 'error' && (
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              {(file.status === 'pending' || file.status === 'error') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="text-red-500 hover:text-red-700"
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

