import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function EmailVerificationGate() {
  const { t } = useLanguage();
  const { user, resendVerificationEmail, signOut } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const email = user?.email ?? '';

  const handleResend = async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const { error: err } = await resendVerificationEmail();
      if (err) setError(err.message);
      else setMessage(t('emailVerifySuccess'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-ypsom-alice rounded-lg shadow-audit p-6">
        <div className="flex items-center gap-2 mb-4">
          <MailCheck className="w-5 h-5 text-ypsom-deep" />
          <h1 className="font-black text-ypsom-deep uppercase tracking-tight">{t('emailVerifyTitle')}</h1>
        </div>
        <p className="text-sm text-ypsom-slate leading-relaxed">
          {t('emailVerifyBody')}
          {email ? (
            <>
              {' '}
              {t('emailVerifySentPrefix')} <span className="font-bold text-ypsom-deep">{email}</span>.
            </>
          ) : null}
        </p>

        {error && (
          <p className="mt-4 text-xs text-red-600 font-medium">
            {t('authErrorPrefix')}
            {error}
          </p>
        )}
        {message && <p className="mt-4 text-xs text-emerald-600 font-medium">{message}</p>}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-ypsom-deep text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-ypsom-shadow disabled:opacity-60 transition-colors"
          >
            {sending ? t('emailVerifyResending') : t('emailVerifyResend')}
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-ypsom-slate hover:text-ypsom-deep transition-colors"
          >
            {t('emailVerifySignOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
