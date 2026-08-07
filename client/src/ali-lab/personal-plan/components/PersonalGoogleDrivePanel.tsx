import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  googleDriveErrorUserMessage,
  type GoogleDriveErrorReason,
} from "@shared/googleDriveErrors";
import {
  connectGoogleDrive,
  disconnectGoogleDriveAccount,
  fetchGoogleDriveStatus,
  type GoogleDriveStatus,
} from "@/cafe/lib/googleDriveClient";
import { GlassCard } from "./GlassCard";
import { personalAppHomePath } from "../personalPlanNav";

function parseDriveErrorReason(raw: string | null): GoogleDriveErrorReason | null {
  if (!raw) return null;
  const allowed = new Set([
    "firebase_admin",
    "no_refresh_token",
    "invalid_state",
    "redirect_mismatch",
    "missing_config",
    "oauth_denied",
    "unknown",
  ]);
  return allowed.has(raw) ? (raw as GoogleDriveErrorReason) : "unknown";
}

/** Connect Drive on personal Overview — backups land in Paystack Documents/Personal/{date}/. */
export function PersonalGoogleDrivePanel() {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("googleDrive");
    if (!result) return;

    if (result === "connected") {
      toast.success("Google Drive connected for personal backups.");
      void loadStatus();
    } else {
      const reason = parseDriveErrorReason(params.get("googleDriveReason"));
      toast.error(googleDriveErrorUserMessage(reason ?? "unknown"), { duration: 12000 });
    }

    params.delete("googleDrive");
    params.delete("googleDriveReason");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectGoogleDrive({ returnPath: personalAppHomePath() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogleDriveAccount();
      toast.success("Google Drive disconnected.");
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
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="p-2 rounded-lg bg-[var(--pp-primary)]/10">
          <Cloud className="size-4 text-[var(--pp-primary)]" />
        </div>
        <div>
          <p className="text-sm font-semibold">Google Drive (personal)</p>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1 leading-relaxed max-w-2xl">
            Connect once to back up bank statements under{" "}
            <span className="font-medium text-[var(--pp-on-surface)]">
              Paystack Documents / Personal / YYYY-MM-DD
            </span>
            . Same Google account as business Drive; personal files stay in the Personal folder.
          </p>
        </div>
      </div>

      {statusError ? (
        <p className="text-xs text-[var(--pp-error)] flex items-start gap-2">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          {statusError}
        </p>
      ) : null}

      {needsReconnect ? (
        <p className="text-xs text-[var(--pp-error)] flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0" />
          Connection needs renewing — reconnect below.
        </p>
      ) : null}

      {loadingStatus ? (
        <p className="text-xs text-[var(--pp-on-surface-variant)] inline-flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          Checking connection…
        </p>
      ) : connected && !needsReconnect ? (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--pp-tertiary)] font-semibold">
            <Cloud className="size-3.5" />
            Connected — personal uploads sync to Drive
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDisconnect()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--pp-outline-variant)] text-[11px] font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleConnect()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-xs font-bold hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
          {needsReconnect ? "Reconnect Google Drive" : "Connect Google Drive"}
        </button>
      )}
    </GlassCard>
  );
}
