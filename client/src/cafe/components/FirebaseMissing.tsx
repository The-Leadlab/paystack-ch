import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export function FirebaseMissing() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-ypsom-alice flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-ypsom-alice rounded-lg shadow-audit p-8 text-center">
        <h1 className="font-black text-ypsom-deep uppercase tracking-tight text-lg mb-2">{t('firebaseMissingTitle')}</h1>
        <p className="text-sm text-ypsom-slate mb-6 leading-relaxed">{t('firebaseMissingBody')}</p>
        <div className="text-left text-xs text-ypsom-slate space-y-3 mb-6 border-t border-ypsom-alice pt-4">
          <p className="font-bold text-ypsom-deep uppercase tracking-widest">{t('firebaseMissingNetlifyHeading')}</p>
          <p>{t('firebaseMissingNetlifyBody')}</p>
          <p className="font-bold text-ypsom-deep uppercase tracking-widest mt-4">{t('firebaseMissingLocalHeading')}</p>
          <p>{t('firebaseMissingLocalBody')}</p>
        </div>
        <a
          href="https://console.firebase.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full py-2.5 bg-ypsom-deep text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-ypsom-shadow transition-colors"
        >
          {t('firebaseMissingCta')}
        </a>
      </div>
    </div>
  );
}
