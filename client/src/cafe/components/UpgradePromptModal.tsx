import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export function UpgradePromptModal({
  documentCap,
  onClose,
  onOpenBilling,
}: {
  documentCap: number;
  onClose: () => void;
  onOpenBilling: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', color: '#fff', padding: 24, maxWidth: 400, width: '90%' }}>
        <h2>{t('upgradePromptTitle')}</h2>
        <p>{t('planLimitDocuments').replace('{n}', String(documentCap))}</p>
        <button
          onClick={() => {
            onOpenBilling();
            onClose();
          }}
          style={{ display: 'block', width: '100%', marginTop: 12 }}
        >
          {t('subscriptionManageBilling')}
        </button>
        <button onClick={onClose} style={{ display: 'block', width: '100%', marginTop: 12 }}>
          {t('upgradePromptDismiss')}
        </button>
      </div>
    </div>
  );
}
