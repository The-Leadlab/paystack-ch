import React, { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function authErrorCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return null;
}

export function EmailVerificationGate() {
  const { t } = useLanguage();
  const { user, resendVerificationEmail, signOut } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownSec]);

  const email = user?.email ?? '';

  const handleResend = async () => {
    if (cooldownSec > 0) return;
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const { error: err } = await resendVerificationEmail();
      if (err) {
        const code = authErrorCode(err);
        if (code === 'auth/too-many-requests') {
          setError(t('emailVerifyRateLimited'));
          setCooldownSec(300);
        } else {
          setError(err.message);
          setCooldownSec(45);
        }
      } else {
        setMessage(t('emailVerifySuccess'));
        setCooldownSec(60);
      }
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
        {cooldownSec > 0 ? (
          <p className="mt-2 text-xs text-ypsom-slate">{t('emailVerifyWait').replace('{s}', String(cooldownSec))}</p>
        ) : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={sending || cooldownSec > 0}
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
