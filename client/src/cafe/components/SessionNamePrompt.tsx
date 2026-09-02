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
import { defaultSessionName } from "../lib/formatLocalDateTime";

const namedKey = (sessionId: string) => `paystack_session_named_${sessionId}`;

export function SessionNamePrompt() {
  const { t } = useLanguage();
  const { currentSession, renameSession, loading } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (loading || !currentSession?.id) return;
    try {
      if (sessionStorage.getItem(namedKey(currentSession.id)) === "1") return;
    } catch {
      return;
    }
    setName(currentSession.name || defaultSessionName());
    setOpen(true);
  }, [currentSession?.id, currentSession?.name, loading]);

  const finish = (save: boolean) => {
    if (!currentSession?.id) return;
    try {
      sessionStorage.setItem(namedKey(currentSession.id), "1");
    } catch {
      /* ignore */
    }
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
