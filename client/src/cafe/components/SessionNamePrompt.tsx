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
import { defaultSessionName, isAutoTimestampSessionName } from "../lib/formatLocalDateTime";

const namedKey = (sessionId: string) => `paystack_session_named_${sessionId}`;

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

/**
 * Prompt only for brand-new auto-timestamp sessions.
 * Renamed sessions (e.g. "08.2020") and previously skipped IDs never re-prompt —
 * including after a second login / new tab (localStorage survives where sessionStorage does not).
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
    // Custom / already-renamed sessions should never interrupt navigation.
    if (!isAutoTimestampSessionName(currentSession.name || "")) {
      markNamedOrSkipped(currentSession.id);
      setOpen(false);
      return;
    }
    setName(currentSession.name || defaultSessionName());
    setOpen(true);
  }, [currentSession?.id, currentSession?.name, loading]);

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
          className="font-editorial"
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
