import React, { useState } from 'react';
import { DocumentProcessor } from './DocumentProcessor';
import { FinancialInsights } from './FinancialInsights';
import { ShieldCheck, Sparkles, Zap, Eye, Building2, LogOut, RefreshCw, User } from 'lucide-react';
import { ProcessedDocument } from '../types';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import { useLanguage } from '../context/LanguageContext';

export function Dashboard() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { currentClient, setCurrentClient } = useClient();
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'insights'>('audit');

  const handleSwitchClient = () => {
    setCurrentClient(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-ypsom-alice sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-ypsom-deep rounded-sm flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm font-serif italic">YP</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-lg text-ypsom-deep tracking-wider leading-none">
                    CAFE <span className="font-light">DE LA PLACE</span>
                  </span>
                  <span className="text-[0.55rem] tracking-[0.3em] text-ypsom-slate uppercase font-bold">{t('dashFinancialTracking')}</span>
                </div>
              </div>
              {currentClient && (
                <div className="flex items-center gap-2 pl-4 border-l border-ypsom-alice">
                  <Building2 className="w-4 h-4 text-ypsom-slate" />
                  <span className="text-sm font-bold text-ypsom-deep">{currentClient.name}</span>
                  <button
                    type="button"
                    onClick={handleSwitchClient}
                    className="p-1.5 rounded-sm text-ypsom-slate hover:bg-ypsom-alice hover:text-ypsom-deep transition-colors"
                    title={t('dashSwitchClientTitle')}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <nav className="flex items-center gap-2">
              {user && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest text-ypsom-slate bg-ypsom-alice/50">
                  <User className="w-3.5 h-3.5" />
                  {user.displayName || user.email}
                </span>
              )}
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-ypsom-deep text-white shadow-md' : 'text-ypsom-slate hover:bg-gray-100'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> {t('dashTabReconciliation')}
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'insights' ? 'bg-ypsom-deep text-white shadow-md' : 'text-ypsom-slate hover:bg-gray-100'}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> {t('dashTabInsights')}
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-2 px-3 py-2 rounded-sm text-[9px] font-bold uppercase tracking-widest text-ypsom-slate hover:bg-red-50 hover:text-red-600 transition-colors"
                title={t('dashSignOutTitle')}
              >
                <LogOut className="w-3.5 h-3.5" /> {t('dashSignOutTitle')}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-10">
        <div className="mb-8 border-l-2 border-ypsom-deep pl-4">
          <h1 className="text-xl font-black text-ypsom-deep uppercase tracking-tighter">
            {activeTab === 'audit' ? t('dashTitleReconciliation') : t('dashTitleInsights')}
          </h1>
          <p className="text-[11px] text-ypsom-slate mt-1 font-bold uppercase tracking-widest opacity-60">
            {activeTab === 'audit' ? t('dashSubtitleAudit') : t('dashSubtitleInsights')}
          </p>
        </div>

        <div className="w-full">
          {activeTab === 'audit' && (
            <DocumentProcessor documents={processedDocuments} setDocuments={setProcessedDocuments} />
          )}
          {activeTab === 'insights' && <FinancialInsights documents={processedDocuments} />}
        </div>
      </main>

      <footer className="bg-white py-6 border-t border-ypsom-alice">
        <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center text-ypsom-slate/40 text-[9px] uppercase font-black tracking-[0.3em]">
          <div>
            &copy; {new Date().getFullYear()} {t('dashFooterCopyright')}
          </div>
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> {t('dashFooterZ2')}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> {t('dashFooterAuditTrail')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
