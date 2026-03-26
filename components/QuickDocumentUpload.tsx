import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader, CheckCircle, XCircle } from 'lucide-react';
import { analyzeFinancialDocument } from '../services/geminiService';
import type { FinancialData } from '../types';

type ProcessingFile = {
  id: string;
  name: string;
  status: 'processing' | 'completed' | 'error';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        uploadTitle: 'Upload Documents',
        uploadDesc: 'Drag & drop invoices, receipts, or bank statements',
        browse: 'Browse Files',
        processing: 'Processing',
        completed: 'Completed',
        error: 'Error',
      },
      fr: {
        uploadTitle: 'Télécharger des documents',
        uploadDesc: 'Glissez-déposez des factures, reçus ou relevés bancaires',
        browse: 'Parcourir',
        processing: 'Traitement',
        completed: 'Terminé',
        error: 'Erreur',
      },
    };
    return translations[language][key] || key;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: ProcessingFile[] = Array.from(fileList).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      status: 'processing' as const,
    }));

    setFiles((prev) => [...newFiles, ...prev]);

    // Process each file
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = newFiles[i].id;

      try {
        const data = await analyzeFinancialDocument(file, 'CHF');
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'completed' as const, data } : f
          )
        );

        // Automatically extract and categorize
        onDataExtracted(data, file.name);
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
              : f
          )
        );
      }
    }
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

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200">
      <h2 className="text-base md:text-lg font-black text-ypsom-deep uppercase mb-4">
        {t('uploadTitle')}
      </h2>

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
          accept="image/*,.pdf"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Processing Status */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
            >
              <FileText className="w-4 h-4 text-ypsom-slate flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-ypsom-deep truncate">{file.name}</p>
                <p className="text-[10px] text-ypsom-slate">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
