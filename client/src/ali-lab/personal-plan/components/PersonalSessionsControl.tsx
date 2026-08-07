import { useCallback, useEffect, useState } from "react";
import { FolderKanban, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  addPersonalSession,
  deletePersonalSession,
  ensureDefaultPersonalSession,
  listPersonalSessions,
  renamePersonalSession,
  setCurrentPersonalSessionId,
  type PersonalSession,
} from "../../lib/personalSessionsStore";
import { useLabLanguage } from "../../context/LabLanguageContext";

export function PersonalSessionsControl() {
  const { t } = useLabLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<PersonalSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const cur = await ensureDefaultPersonalSession();
    const all = await listPersonalSessions();
    setSessions(all);
    setCurrentId(cur.id);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = async (id: string) => {
    setBusy(true);
    try {
      await setCurrentPersonalSessionId(id);
      setCurrentId(id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = window.prompt(t("personalSessionNamePrompt"), `Personal ${new Date().toISOString().slice(0, 7)}`);
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const row = await addPersonalSession(name.trim());
      await refresh();
      setCurrentId(row.id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (s: PersonalSession) => {
    const name = window.prompt(t("personalSessionRenamePrompt"), s.name);
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await renamePersonalSession(s.id, name.trim());
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: PersonalSession) => {
    if (!window.confirm(t("personalSessionDeleteConfirm").replace("{name}", s.name))) return;
    setBusy(true);
    try {
      await deletePersonalSession(s.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const current = sessions.find((s) => s.id === currentId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[var(--pp-outline-variant)] text-[10px] font-bold uppercase tracking-wide text-[var(--pp-on-surface-variant)] hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FolderKanban className="size-3.5" />}
        <span className="hidden sm:inline max-w-[9rem] truncate">
          {current?.name || t("personalSessions")}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[var(--pp-outline-variant)] bg-[var(--pp-surface)] shadow-lg z-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{t("personalSessions")}</p>
            <button type="button" className="p-1 rounded hover:bg-[var(--pp-surface-high)]" onClick={() => setOpen(false)}>
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-[var(--pp-on-surface-variant)] leading-snug">{t("personalSessionsHint")}</p>
          <ul className="max-h-48 overflow-auto space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <div
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${
                    s.id === currentId ? "bg-[var(--pp-primary)]/10 text-[var(--pp-primary)]" : "hover:bg-[var(--pp-surface-high)]"
                  }`}
                >
                  <button type="button" className="flex-1 text-left font-medium truncate" onClick={() => void select(s.id)}>
                    {s.name}
                  </button>
                  <button type="button" className="text-[10px] opacity-70 hover:opacity-100" onClick={() => void rename(s)}>
                    {t("personalSessionRename")}
                  </button>
                  <button type="button" className="p-1 opacity-70 hover:opacity-100" onClick={() => void remove(s)} aria-label="Delete">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-[11px] font-bold"
          >
            <Plus className="size-3.5" />
            {t("personalSessionCreate")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
