import { useEffect, useState } from "react";
import { Loader2, Eye, Upload, UserCheck, X } from "lucide-react";
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
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";
import { useClientSessionAccess } from "../context/ClientSessionAccessContext";
import { resolveSessionAccessRequest } from "../lib/sessionAccessRequests";
import { defaultSessionName } from "../lib/formatLocalDateTime";
import { toast } from "sonner";

export function SessionAccessBanner() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addSession, setCurrentSession, sessions } = useSession();
  const {
    role,
    isViewOnly,
    pendingRequests,
    myRequest,
    requestUploadAccess,
    grantedSessionId,
  } = useClientSessionAccess();

  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRequestId, setApproveRequestId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");

  useEffect(() => {
    if (!grantedSessionId || sessions.length === 0) return;
    const match = sessions.find((s) => s.id === grantedSessionId);
    if (match) setCurrentSession(match);
  }, [grantedSessionId, sessions, setCurrentSession]);

  if (role === "primary" && pendingRequests.length === 0) return null;
  if (role !== "primary" && !isViewOnly && role !== "contributor") return null;
  if (role === "contributor" && myRequest?.status === "approved") return null;

  const openApprove = (requestId: string) => {
    setApproveRequestId(requestId);
    setNewSessionName(defaultSessionName());
    setApproveOpen(true);
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
      await requestUploadAccess();
      toast.success(t("sessionAccessRequestSent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {role === "primary" && pendingRequests.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 space-y-2">
          <p className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="size-4 text-amber-600" />
            {t("sessionAccessPrimaryTitle")}
          </p>
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-lg bg-background/80 border border-border px-3 py-2"
            >
              <p className="text-sm text-muted-foreground">
                {req.requesterLabel || t("sessionAccessAnonymousViewer")}
              </p>
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  className="font-display bg-brand-red text-white hover:bg-brand-red/90"
                  disabled={busy}
                  onClick={() => openApprove(req.id)}
                >
                  {t("sessionAccessApprove")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="font-display"
                  disabled={busy}
                  onClick={() => void onDeny(req.id)}
                >
                  {t("sessionAccessDeny")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {isViewOnly ? (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2">
            <Eye className="size-4 text-sky-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-display text-sm font-semibold">{t("sessionAccessViewTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("sessionAccessViewHint")}</p>
              {myRequest?.status === "pending" ? (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t("sessionAccessPending")}</p>
              ) : null}
            </div>
          </div>
          {!myRequest || myRequest.status === "denied" ? (
            <Button
              type="button"
              size="sm"
              className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-1.5 shrink-0"
              disabled={busy}
              onClick={() => void onRequest()}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t("sessionAccessRequestUpload")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {role === "contributor" && grantedSessionId ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-foreground">
          {t("sessionAccessContributorHint")}
        </div>
      ) : null}

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
