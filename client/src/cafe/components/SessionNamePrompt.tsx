import { useEffect, useState } from "react";
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
import { useSession } from "../context/SessionContext";
import { isAutoTimestampSessionName } from "../lib/formatLocalDateTime";

const namedKey = (sessionId: string) => `paystack_session_named_${sessionId}`;

/** Only interrupt for sessions created in the last few minutes (true “New Session”). */
const NEW_SESSION_PROMPT_MS = 3 * 60 * 1000;

function wasNamedOrSkipped(sessionId: string): boolean {
  try {
    if (localStorage.getItem(namedKey(sessionId)) === "1") return true;
  } catch {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(namedKey(sessionId)) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function markNamedOrSkipped(sessionId: string) {
  try {
    localStorage.setItem(namedKey(sessionId), "1");
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(namedKey(sessionId), "1");
  } catch {
    /* ignore */
  }
}

function isFreshlyCreated(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= NEW_SESSION_PROMPT_MS;
}

/**
 * Prompt only right after "+ New Session" (fresh auto-timestamp name).
 * Existing / older timestamp sessions never re-prompt — including after login or /admin-uk.
 */
export function SessionNamePrompt() {
  const { t } = useLanguage();
  const { currentSession, renameSession, loading } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (loading || !currentSession?.id) {
      setOpen(false);
      return;
    }
    if (wasNamedOrSkipped(currentSession.id)) {
      setOpen(false);
      return;
    }

    const autoName = isAutoTimestampSessionName(currentSession.name || "");

    // Custom / already-renamed sessions: never interrupt.
    if (!autoName) {
      markNamedOrSkipped(currentSession.id);
      setOpen(false);
      return;
    }

    // Old auto-timestamp sessions (e.g. resumed from sidebar / last login): silence forever.
    if (!isFreshlyCreated(currentSession.created_at)) {
      markNamedOrSkipped(currentSession.id);
      setOpen(false);
      return;
    }

    // Fresh new session only — leave the field empty so the placeholder guides naming.
    setName("");
    setOpen(true);
  }, [currentSession?.id, currentSession?.name, currentSession?.created_at, loading]);

  const finish = (save: boolean) => {
    if (!currentSession?.id) return;
    markNamedOrSkipped(currentSession.id);
    if (save && name.trim()) {
      void renameSession(currentSession.id, name.trim());
    }
    setOpen(false);
  };

  if (!currentSession) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{t("sessionNamePromptTitle")}</DialogTitle>
          <DialogDescription>{t("sessionNamePromptBody")}</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sessionNamePromptPlaceholder")}
          className="font-editorial bg-background text-foreground placeholder:text-muted-foreground"
          autoFocus
        />
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" className="font-display w-full sm:w-auto" onClick={() => finish(false)}>
            {t("sessionNamePromptSkip")}
          </Button>
          <Button
            type="button"
            className="font-display bg-brand-red text-white hover:bg-brand-red/90 w-full sm:w-auto"
            onClick={() => finish(true)}
          >
            {t("sessionNamePromptSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
