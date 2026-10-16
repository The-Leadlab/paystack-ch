import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { listAdminErrorLogs, type AdminGlobalErrorEntry } from "@/lib/adminUsersClient";
import { adminOutlineBtnClass, adminPanelCardClass } from "./adminUserUi";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type Props = {
  onOpenUser?: (uid: string) => void;
};

export function AdminErrorLogsPanel({ onOpenUser }: Props) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<AdminGlobalErrorEntry[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminErrorLogs({ limit: 120 });
      setErrors(data.errors);
      setGeneratedAt(data.generatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className={`${adminPanelCardClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              {t("adminErrorLogsTitle")}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("adminErrorLogsHint")}</p>
            {generatedAt ? (
              <p className="text-[11px] text-muted-foreground">
                {t("adminUsageLastSynced").replace("{time}", formatDateTime(generatedAt))}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`${adminOutlineBtnClass} text-xs`}
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("adminUserRefresh")}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive font-medium" role="alert">
            {error}
          </p>
        ) : null}

        {loading && errors.length === 0 ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-brand-red" />
          </div>
        ) : errors.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("adminErrorLogsEmpty")}</p>
        ) : (
          <div className="rounded-lg border border-border divide-y max-h-[70vh] overflow-y-auto">
            {errors.map((entry) => (
              <div key={entry.id} className="px-3 py-3 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium truncate">{entry.fileName || t("adminErrorLogsUnknownFile")}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                  </div>
                  {entry.uid ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`${adminOutlineBtnClass} text-xs shrink-0 gap-1`}
                      onClick={() => onOpenUser?.(entry.uid!)}
                    >
                      <User className="size-3.5" />
                      {entry.email || entry.displayName || entry.uid.slice(0, 8)}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("adminErrorLogsUnknownUser")}</span>
                  )}
                </div>
                {entry.errorCode ? (
                  <p className="font-mono text-xs text-destructive break-all">{entry.errorCode}</p>
                ) : null}
                {entry.errorMessage ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {entry.errorMessage}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
