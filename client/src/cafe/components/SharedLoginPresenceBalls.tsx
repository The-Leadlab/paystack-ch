import { useEffect, useMemo, useState } from "react";
import { Loader2, Upload, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";
import { useClientSessionAccess } from "../context/ClientSessionAccessContext";
import { presenceInitials, type ClientPresence } from "../lib/clientPresence";
import { resolveSessionAccessRequest } from "../lib/sessionAccessRequests";
import { defaultSessionName } from "../lib/formatLocalDateTime";
import { isMultiLoginMode } from "@shared/loginMode";
import { toast } from "sonner";

function PresenceBall({
  peer,
  size = "md",
  ring,
  title,
  label,
}: {
  peer: ClientPresence;
  size?: "sm" | "md";
  ring?: boolean;
  title?: string;
  label?: string;
}) {
  const name = label || peer.displayName;
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";
  return (
    <span
      title={title || name}
      className={`relative inline-flex ${dim} items-center justify-center rounded-full font-display font-bold text-white shadow-sm border border-white/25 shrink-0`}
      style={{ backgroundColor: peer.color }}
    >
      {presenceInitials(name)}
      {ring ? (
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-cdlp-black" />
      ) : null}
      {peer.role === "viewer" ? (
        <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/30" />
      ) : null}
    </span>
  );
}

type Props = {
  /** Compact for mobile header / rail */
  compact?: boolean;
};

/**
 * Google Docs–style presence balls for shared multi-login accounts.
 * Hosts approve upload sessions; viewers request access.
 */
export function SharedLoginPresenceBalls({ compact = false }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addSession, setCurrentSession, sessions } = useSession();
  const {
    loginMode,
    role,
    presence,
    pendingRequests,
    myRequest,
    requestUploadAccess,
    grantedSessionId,
  } = useClientSessionAccess();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRequestId, setApproveRequestId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");

  const peers = useMemo(() => presence.filter((p) => !p.isSelf), [presence]);
  const self = useMemo(() => presence.find((p) => p.isSelf) ?? null, [presence]);
  const visibleBalls = useMemo(() => {
    const list = [...presence];
    return list.slice(0, 5);
  }, [presence]);
  const overflow = Math.max(0, presence.length - 5);

  const peerLabel = (peer: ClientPresence) =>
    peer.role === "primary" ? t("presenceRoleHost") : peer.displayName;

  // Switch contributor onto granted session
  useEffect(() => {
    if (!grantedSessionId || sessions.length === 0) return;
    const match = sessions.find((s) => s.id === grantedSessionId);
    if (match) setCurrentSession(match);
  }, [grantedSessionId, sessions, setCurrentSession]);

  if (!isMultiLoginMode(loginMode) || presence.length === 0) return null;
  // Only show cluster when more than one browser is live, or viewer needs the control
  if (presence.length < 2 && role === "primary" && pendingRequests.length === 0) return null;

  const openApprove = (requestId: string) => {
    setApproveRequestId(requestId);
    setNewSessionName(defaultSessionName());
    setApproveOpen(true);
    setOpen(false);
  };

  const onApprove = async () => {
    if (!user?.uid || !approveRequestId) return;
    setBusy(true);
    try {
      const session = await addSession(newSessionName.trim() || defaultSessionName());
      if (!session) throw new Error("Could not create session");
      await resolveSessionAccessRequest(user.uid, approveRequestId, "approved", {
        sessionId: session.id,
        sessionName: session.name,
      });
      toast.success(t("sessionAccessApproved"));
      setApproveOpen(false);
      setApproveRequestId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDeny = async (requestId: string) => {
    if (!user?.uid) return;
    setBusy(true);
    try {
      await resolveSessionAccessRequest(user.uid, requestId, "denied");
      toast.success(t("sessionAccessDenied"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onRequest = async () => {
    setBusy(true);
    try {
      const result = await requestUploadAccess();
      if (result === "claimed") {
        toast.success(t("sessionAccessBecameHost"));
        setOpen(false);
      } else {
        toast.success(t("sessionAccessRequestSent"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/permission|insufficient/i.test(msg)) {
        toast.error(t("sessionAccessPermissionError"));
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const pendingForPeer = (clientSessionId: string) =>
    pendingRequests.find((r) => r.requesterClientSessionId === clientSessionId);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center ${compact ? "gap-0" : "gap-1"} rounded-full pl-0.5 pr-1 py-0.5 hover:bg-cdlp-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cdlp-gold/50`}
            aria-label={t("presenceAria")}
            title={t("presenceTitle")}
          >
            <span className="flex items-center -space-x-2">
              {visibleBalls.map((peer) => {
                const name = peerLabel(peer);
                return (
                <PresenceBall
                  key={peer.clientSessionId}
                  peer={peer}
                  label={name}
                  size={compact ? "sm" : "md"}
                  ring={peer.isSelf}
                  title={`${name}${peer.isSelf ? ` (${t("presenceYou")})` : ""} · ${
                    peer.role === "primary"
                      ? t("presenceRoleHost")
                      : peer.role === "contributor"
                        ? t("presenceRoleContributor")
                        : t("presenceRoleViewer")
                  }`}
                />
              );
              })}
              {overflow > 0 ? (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cdlp-border text-[10px] font-display font-bold text-cdlp-muted border border-cdlp-black">
                  +{overflow}
                </span>
              ) : null}
            </span>
            {!compact && peers.length > 0 ? (
              <span className="text-[10px] text-cdlp-muted font-display pl-1 pr-0.5 tabular-nums">
                {presence.length}
              </span>
            ) : null}
            {pendingRequests.length > 0 && role === "primary" ? (
              <span className="ml-0.5 size-2 rounded-full bg-amber-400 shrink-0" aria-hidden />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-72 p-0 border-cdlp-border bg-cdlp-black text-foreground shadow-xl"
        >
          <div className="px-3 py-2.5 border-b border-cdlp-border">
            <p className="font-display text-xs font-semibold">{t("presencePopoverTitle")}</p>
            <p className="text-[11px] text-cdlp-muted mt-0.5">{t("presencePopoverHint")}</p>
          </div>
          <ul className="max-h-56 overflow-y-auto divide-y divide-cdlp-border">
            {presence.map((peer) => {
              const pending = pendingForPeer(peer.clientSessionId);
              const name = peerLabel(peer);
              return (
                <li key={peer.clientSessionId} className="flex items-center gap-2.5 px-3 py-2.5">
                  <PresenceBall peer={peer} label={name} size="sm" ring={peer.isSelf} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {name}
                      {peer.isSelf ? (
                        <span className="text-cdlp-muted font-normal"> · {t("presenceYou")}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-cdlp-muted">
                      {peer.role === "primary"
                        ? t("presenceRoleHost")
                        : peer.role === "contributor"
                          ? t("presenceRoleContributor")
                          : t("presenceRoleViewer")}
                      {pending ? ` · ${t("sessionAccessPending")}` : ""}
                    </p>
                  </div>
                  {role === "primary" && pending ? (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-[11px] font-display bg-brand-red text-white hover:bg-brand-red/90"
                        disabled={busy}
                        onClick={() => openApprove(pending.id)}
                      >
                        {t("sessionAccessApprove")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px] font-display"
                        disabled={busy}
                        onClick={() => void onDeny(pending.id)}
                      >
                        {t("sessionAccessDeny")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {role === "viewer" ? (
            <div className="px-3 py-2.5 border-t border-cdlp-border space-y-2">
              <p className="text-[11px] text-cdlp-muted">{t("presenceViewerHint")}</p>
              {myRequest?.status === "pending" ? (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <UserCheck className="size-3.5" />
                  {t("sessionAccessPending")}
                </p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-1.5"
                  disabled={busy}
                  onClick={() => void onRequest()}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  {t("sessionAccessRequestUpload")}
                </Button>
              )}
            </div>
          ) : null}
          {role === "primary" && pendingRequests.length > 0 ? (
            <div className="px-3 py-2 border-t border-cdlp-border text-[11px] text-amber-400 flex items-center gap-1.5">
              <UserCheck className="size-3.5" />
              {t("presencePendingCount").replace("{n}", String(pendingRequests.length))}
            </div>
          ) : null}
          {self ? (
            <div className="px-3 py-2 border-t border-cdlp-border text-[10px] text-cdlp-muted">
              {t("presenceYouAre")}{" "}
              <span className="text-foreground font-medium">{peerLabel(self)}</span>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t("sessionAccessApproveTitle")}</DialogTitle>
            <DialogDescription>{t("sessionAccessApproveBody")}</DialogDescription>
          </DialogHeader>
          <Input
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder={t("sessionNamePromptPlaceholder")}
            className="font-editorial"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)} disabled={busy}>
              <X className="size-3.5 mr-1" />
              {t("sessionAccessApproveCancel")}
            </Button>
            <Button
              type="button"
              className="bg-brand-red text-white hover:bg-brand-red/90 font-display"
              disabled={busy}
              onClick={() => void onApprove()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : t("sessionAccessApproveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
