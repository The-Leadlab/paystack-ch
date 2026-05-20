import React, { useEffect, useState } from 'react';
import { Loader2, LogOut, MailCheck } from 'lucide-react';
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
  const { user, resendVerificationEmail, refreshAuthUser, signOut } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
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

  const handleRefresh = async () => {
    setError(null);
    setMessage(null);
    setChecking(true);
    try {
      const { emailVerified } = await refreshAuthUser();
      if (!emailVerified) {
        setMessage(t('emailVerifyStillPending'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-[100dvh] min-h-screen bg-cdlp-dark flex items-center justify-center px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] touch-manipulation">
      <div className="max-w-md w-full border border-cdlp-border rounded-xl bg-cdlp-card p-6 sm:p-8 shadow-card space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-cdlp-gold/15 flex items-center justify-center border border-cdlp-gold/40">
          <MailCheck className="w-7 h-7 text-cdlp-gold" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-lg font-black uppercase tracking-wider text-white">{t('emailVerifyTitle')}</h1>
          <p className="text-xs text-cdlp-muted leading-relaxed">
            {t('emailVerifyBody')}
            {email ? (
              <>
                {' '}
                {t('emailVerifySentPrefix')}{' '}
                <span className="font-bold text-cdlp-gold">{email}</span>.
              </>
            ) : null}
          </p>
          <p className="text-[11px] leading-relaxed text-left sm:text-center rounded-lg border border-cdlp-gold/25 bg-cdlp-gold/[0.07] px-3 py-2.5 text-cdlp-muted">
            <span className="font-bold text-cdlp-gold uppercase tracking-wide text-[10px] block mb-1">
              {t('emailVerifySpamHeading')}
            </span>
            {t('emailVerifySpamHint')}
          </p>
        </div>

        {error ? (
          <p className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
            {t('authErrorPrefix')}
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded px-3 py-2">
            {message}
          </p>
        ) : null}
        {cooldownSec > 0 ? (
          <p className="text-[10px] text-cdlp-muted text-center">{t('emailVerifyWait').replace('{s}', String(cooldownSec))}</p>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={checking}
            className="w-full h-12 rounded-sm bg-cdlp-gold text-cdlp-black font-black text-xs uppercase tracking-wider hover:bg-cdlp-gold-light disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {checking ? t('emailVerifyChecking') : t('emailVerifyRefresh')}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={sending || cooldownSec > 0}
            className="w-full h-10 rounded-sm border border-cdlp-border text-[10px] font-bold uppercase tracking-widest text-cdlp-muted hover:text-white disabled:opacity-50 transition-colors"
          >
            {sending ? t('emailVerifyResending') : t('emailVerifyResend')}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full h-10 rounded-sm border border-cdlp-border text-[10px] font-bold uppercase text-cdlp-muted hover:text-white flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('emailVerifySignOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
