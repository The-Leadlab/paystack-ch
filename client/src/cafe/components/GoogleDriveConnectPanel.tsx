import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import {
  googleDriveErrorUserMessage,
  type GoogleDriveErrorReason,
} from '@shared/googleDriveErrors';
import {
  connectGoogleDrive,
  disconnectGoogleDriveAccount,
  fetchGoogleDriveStatus,
  type GoogleDriveStatus,
} from '../lib/googleDriveClient';

function parseDriveErrorReason(raw: string | null): GoogleDriveErrorReason | null {
  if (!raw) return null;
  const allowed = new Set([
    'firebase_admin',
    'no_refresh_token',
    'invalid_state',
    'redirect_mismatch',
    'missing_config',
    'oauth_denied',
    'unknown',
  ]);
  return allowed.has(raw) ? (raw as GoogleDriveErrorReason) : 'unknown';
}

export function GoogleDriveConnectPanel() {
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      setStatus(await fetchGoogleDriveStatus());
    } catch (e) {
      setStatus(null);
      setStatusError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  // Land here after the OAuth redirect round-trip (see server/googleDrive.ts's callback route).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('googleDrive');
    if (!result) return;

    if (result === 'connected') {
      toast.success('Google Drive connected.');
      void loadStatus();
    } else {
      const reason = parseDriveErrorReason(params.get('googleDriveReason'));
      toast.error(googleDriveErrorUserMessage(reason ?? 'unknown'), { duration: 12000 });
    }

    params.delete('googleDrive');
    params.delete('googleDriveReason');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectGoogleDrive();
      // No further code runs on success — connectGoogleDrive navigates away.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogleDriveAccount();
      toast.success('Google Drive disconnected.');
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected ?? false;
  const needsReconnect = status?.needsReconnect ?? false;

  return (
    <section className="ba-panel space-y-4">
      <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
        <Cloud className="w-4 h-4 shrink-0 text-cdlp-muted" aria-hidden />
        Google Drive
      </h2>
      <p className="text-xs text-cdlp-muted leading-relaxed">
        Connect Google Drive so every document you upload is automatically saved to your own Drive folder
        &ldquo;Paystack Documents&rdquo;.
      </p>

      {statusError ? (
        <p className="flex items-start gap-2 text-[10px] font-medium text-amber-300/95 bg-amber-950/25 border border-amber-900/35 rounded-md px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
          {statusError}
        </p>
      ) : null}

      {needsReconnect ? (
        <p className="flex items-center gap-2 text-[10px] font-bold text-red-400/90 bg-red-950/25 border border-red-900/30 rounded-md px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Your Google Drive connection needs to be renewed. Reconnect below.
        </p>
      ) : null}

      {loadingStatus ? (
        <div className="flex items-center gap-2 text-cdlp-muted text-xs">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Checking connection…
        </div>
      ) : connected && !needsReconnect ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDisconnect()}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-cdlp-border bg-cdlp-dark/40 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-cdlp-muted hover:border-cdlp-gold/35 hover:bg-cdlp-cream/30 hover:text-white disabled:opacity-50 transition-colors"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cdlp-gold" aria-hidden />
          ) : (
            <Unlink className="w-3.5 h-3.5 text-cdlp-gold/80" aria-hidden />
          )}
          Disconnect Google Drive
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleConnect()}
          className="w-full h-11 rounded-sm bg-cdlp-gold text-white font-black text-xs uppercase tracking-wider hover:bg-cdlp-gold-light disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Cloud className="w-4 h-4" aria-hidden />}
          {needsReconnect ? 'Reconnect Google Drive' : 'Connect Google Drive'}
        </button>
      )}
    </section>
  );
}
