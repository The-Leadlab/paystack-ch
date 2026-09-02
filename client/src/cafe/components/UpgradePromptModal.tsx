import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export function UpgradePromptModal({
  title,
  body,
  primaryCta,
  onClose,
  onPrimary,
}: {
  title: string;
  body: string;
  primaryCta: string;
  onClose: () => void;
  onPrimary: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', color: '#fff', padding: 24, maxWidth: 400, width: '90%' }}>
        <h2>{title}</h2>
        <p>{body}</p>
        <button
          onClick={() => {
            onPrimary();
            onClose();
          }}
          style={{ display: 'block', width: '100%', marginTop: 12 }}
        >
          {primaryCta}
        </button>
        <button onClick={onClose} style={{ display: 'block', width: '100%', marginTop: 12 }}>
          {t('upgradePromptDismiss')}
        </button>
      </div>
    </div>
  );
}
