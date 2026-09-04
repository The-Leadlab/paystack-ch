import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Upload, UserCheck, X } from "lucide-react";
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
import { kickSharedClientSession, presenceInitials, type ClientPresence } from "../lib/clientPresence";
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
  const dim = size === "sm" ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";
  return (
    <span
      title={title || name}
      className={`relative inline-flex ${dim} items-center justify-center rounded-full font-display font-bold text-white shadow-sm border border-white/20 shrink-0`}
      style={{ backgroundColor: peer.color }}
    >
      {presenceInitials(name)}
      {ring ? (
        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 border-2 border-cdlp-black" />
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
 * Compact presence cluster for shared multi-login accounts.
 * Hosts can remove other browsers; viewers request upload access.
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
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRequestId, setApproveRequestId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");

  const peers = useMemo(() => presence.filter((p) => !p.isSelf), [presence]);
  const self = useMemo(() => presence.find((p) => p.isSelf) ?? null, [presence]);
  const visibleBalls = useMemo(() => {
    const list = [...presence];
    return list.slice(0, 4);
  }, [presence]);
  const overflow = Math.max(0, presence.length - 4);

  const peerLabel = (peer: ClientPresence) =>
    peer.role === "primary" ? t("presenceRoleHost") : peer.displayName;

  useEffect(() => {
    if (!grantedSessionId || sessions.length === 0) return;
    const match = sessions.find((s) => s.id === grantedSessionId);
    if (match) setCurrentSession(match);
  }, [grantedSessionId, sessions, setCurrentSession]);

  if (!isMultiLoginMode(loginMode) || presence.length === 0) return null;
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

  const onRemove = async (peer: ClientPresence) => {
    if (!user?.uid || peer.isSelf || role !== "primary") return;
    setKickingId(peer.clientSessionId);
    try {
      await kickSharedClientSession(user.uid, peer.clientSessionId);
      toast.success(t("presenceRemoved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setKickingId(null);
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
            className={`inline-flex items-center ${compact ? "gap-0" : "gap-0.5"} rounded-full pl-0.5 pr-1 py-0.5 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cdlp-gold/40`}
            aria-label={t("presenceAria")}
            title={t("presenceTitle")}
          >
            <span className="flex items-center -space-x-1.5">
              {visibleBalls.map((peer) => {
                const name = peerLabel(peer);
                return (
                  <PresenceBall
                    key={peer.clientSessionId}
                    peer={peer}
                    label={name}
                    size="sm"
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
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cdlp-border text-[9px] font-display font-bold text-cdlp-muted border border-cdlp-black">
                  +{overflow}
                </span>
              ) : null}
            </span>
            {!compact && peers.length > 0 ? (
              <span className="text-[10px] text-cdlp-muted font-display pl-0.5 tabular-nums">
                {presence.length}
              </span>
            ) : null}
            {pendingRequests.length > 0 && role === "primary" ? (
              <span className="ml-0.5 size-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={6}
          className="w-52 p-0 border-cdlp-border !bg-cdlp-black !text-foreground shadow-lg"
        >
          <div className="px-2.5 py-1.5 border-b border-cdlp-border flex items-center justify-between gap-2">
            <p className="font-display text-[11px] font-semibold truncate">{t("presencePopoverTitle")}</p>
            <span className="text-[10px] text-cdlp-muted tabular-nums shrink-0">{presence.length}</span>
          </div>
          <ul className="max-h-40 overflow-y-auto">
            {presence.map((peer) => {
              const pending = pendingForPeer(peer.clientSessionId);
              const name = peerLabel(peer);
              const canRemove = role === "primary" && !peer.isSelf;
              return (
                <li
                  key={peer.clientSessionId}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/[0.03]"
                >
                  <PresenceBall peer={peer} label={name} size="sm" ring={peer.isSelf} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate leading-tight">
                      {name}
                      {peer.isSelf ? (
                        <span className="text-cdlp-muted font-normal"> · {t("presenceYou")}</span>
                      ) : null}
                    </p>
                    <p className="text-[9px] text-cdlp-muted leading-tight">
                      {peer.role === "primary"
                        ? t("presenceRoleHost")
                        : peer.role === "contributor"
                          ? t("presenceRoleContributor")
                          : t("presenceRoleViewer")}
                      {pending ? ` · ${t("sessionAccessPending")}` : ""}
                    </p>
                  </div>
                  {role === "primary" && pending ? (
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] font-display bg-brand-red text-white hover:bg-brand-red/90"
                        disabled={busy}
                        onClick={() => openApprove(pending.id)}
                      >
                        {t("sessionAccessApprove")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px] font-display"
                        disabled={busy}
                        onClick={() => void onDeny(pending.id)}
                      >
                        {t("sessionAccessDeny")}
                      </Button>
                    </div>
                  ) : canRemove ? (
                    <button
                      type="button"
                      className="shrink-0 p-1 rounded text-cdlp-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      title={t("presenceRemove")}
                      aria-label={t("presenceRemove")}
                      disabled={busy || kickingId === peer.clientSessionId}
                      onClick={() => void onRemove(peer)}
                    >
                      {kickingId === peer.clientSessionId ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {role === "viewer" ? (
            <div className="px-2.5 py-2 border-t border-cdlp-border space-y-1.5">
              {myRequest?.status === "pending" ? (
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <UserCheck className="size-3" />
                  {t("sessionAccessPending")}
                </p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-7 text-[11px] font-display bg-brand-red text-white hover:bg-brand-red/90 gap-1"
                  disabled={busy}
                  onClick={() => void onRequest()}
                >
                  {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                  {t("sessionAccessRequestUpload")}
                </Button>
              )}
            </div>
          ) : null}
          {role === "primary" && pendingRequests.length > 0 ? (
            <div className="px-2.5 py-1.5 border-t border-cdlp-border text-[10px] text-amber-400 flex items-center gap-1">
              <UserCheck className="size-3" />
              {t("presencePendingCount").replace("{n}", String(pendingRequests.length))}
            </div>
          ) : null}
          {self ? (
            <div className="px-2.5 py-1 border-t border-cdlp-border text-[9px] text-cdlp-muted">
              {t("presenceYouAre")}{" "}
              <span className="text-foreground/80 font-medium">{peerLabel(self)}</span>
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
