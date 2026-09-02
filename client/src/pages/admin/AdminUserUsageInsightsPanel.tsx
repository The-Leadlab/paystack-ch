import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/cafe/context/LanguageContext";
import type {
  AdminActivityEvent,
  AdminDocumentSnapshot,
  AdminLoginVisit,
  AdminUsageSummary,
  AdminWorkSession,
} from "@/lib/adminUsersClient";
import { adminOutlineBtnClass, adminPanelCardClass } from "./adminUserUi";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function activityTypeLabel(type: string, t: (k: string) => string): string {
  if (type === "login") return t("adminActivityTypeLogin");
  if (type === "logout") return t("adminActivityTypeLogout");
  if (type === "session_heartbeat") return t("adminActivityTypeHeartbeat");
  if (type === "doc_upload") return t("adminActivityTypeUpload");
  if (type === "doc_processed") return t("adminActivityTypeProcessed");
  if (type === "document_process_error") return t("adminActivityTypeError");
  return type;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

type Props = {
  loading: boolean;
  errorsOnly: boolean;
  onToggleErrorsOnly: () => void;
  onRefresh: () => void;
  summary: AdminUsageSummary | null;
  logins: AdminLoginVisit[];
  workSessions: AdminWorkSession[];
  events: AdminActivityEvent[];
  documents: AdminDocumentSnapshot[];
};

export function AdminUserUsageInsightsPanel({
  loading,
  errorsOnly,
  onToggleErrorsOnly,
  onRefresh,
  summary,
  logins,
  workSessions,
  events,
  documents,
}: Props) {
  const { t } = useLanguage();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className={`${adminPanelCardClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{t("adminUsageOverviewTitle")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={errorsOnly ? "default" : "outline"}
              className={`font-display text-xs ${errorsOnly ? "bg-brand-red text-white hover:bg-brand-red/90" : ""}`}
              onClick={onToggleErrorsOnly}
            >
              <AlertTriangle className="size-3.5 mr-1" />
              {t("adminActivityErrorsOnly")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`${adminOutlineBtnClass} text-xs`}
              disabled={loading}
              onClick={onRefresh}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("adminUserRefresh")}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("adminUsagePrivacyHint")}</p>
        {loading && !summary ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-brand-red" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label={t("adminUsageKpiLogins")} value={summary?.loginCount ?? "—"} />
            <Kpi label={t("adminUsageKpiSessions")} value={summary?.workSessionCount ?? "—"} />
            <Kpi label={t("adminUsageKpiDocs")} value={summary?.documentCount ?? "—"} />
            <Kpi
              label={t("adminUsageKpiErrors")}
              value={summary?.errorCount ?? "—"}
              danger={(summary?.errorCount ?? 0) > 0}
            />
            <Kpi label={t("adminUsageKpiCompleted")} value={summary?.completedCount ?? "—"} />
            <Kpi
              label={t("adminUsageKpiLastSession")}
              value={summary?.lastWorkSessionName ?? "—"}
              small
            />
            <Kpi
              label={t("adminUsageKpiLastSessionDocs")}
              value={summary?.lastWorkSessionDocs ?? "—"}
            />
            <Kpi
              label={t("adminUsageKpiLastSessionErrors")}
              value={summary?.lastWorkSessionErrors ?? "—"}
              danger={(summary?.lastWorkSessionErrors ?? 0) > 0}
            />
          </div>
        )}
      </div>

      <div className={`${adminPanelCardClass} space-y-3`}>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <LogIn className="size-3.5" />
            {t("adminUsageLoginsTitle")}
          </span>
        </SectionTitle>
        <p className="text-xs text-muted-foreground">{t("adminUsageLoginsHint")}</p>
        {logins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("adminUsageLoginsEmpty")}</p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y">
            {logins.map((login, i) => (
              <div
                key={login.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground font-display text-[11px] tabular-nums">
                  #{logins.length - i}
                </span>
                <span className="text-foreground">{formatDateTime(login.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${adminPanelCardClass} space-y-3`}>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="size-3.5" />
            {t("adminUsageSessionsTitle")}
          </span>
        </SectionTitle>
        <p className="text-xs text-muted-foreground">{t("adminUsageSessionsHint")}</p>
        {workSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("adminUsageSessionsEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {workSessions.map((session) => {
              const open = expandedSessionId === session.id;
              return (
                <div key={session.id} className="rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-2 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedSessionId(open ? null : session.id)}
                  >
                    {open ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-sm min-w-0 flex-1 truncate">{session.name}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDateTime(session.createdAt)}
                    </span>
                    <span className="inline-flex gap-1.5 text-[11px]">
                      <BadgeSoft>
                        {session.documentCount} {t("adminUsageFilesShort")}
                      </BadgeSoft>
                      <BadgeSoft tone="ok">
                        {session.completedCount} {t("adminUsageDoneShort")}
                      </BadgeSoft>
                      {session.errorCount > 0 ? (
                        <BadgeSoft tone="danger">
                          {session.errorCount} {t("adminUsageErrShort")}
                        </BadgeSoft>
                      ) : null}
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t border-border bg-muted/20 px-3 py-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <Meta label={t("adminActivityColPages")} value={session.totalPages ?? "—"} />
                        <Meta
                          label={t("adminActivityColDuration")}
                          value={formatDuration(session.avgDurationMs)}
                        />
                        <Meta label={t("adminUsagePending")} value={session.pendingCount} />
                        <Meta label={t("adminUsageProcessing")} value={session.processingCount} />
                      </div>
                      {session.errors.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("adminUsageNoSessionErrors")}</p>
                      ) : (
                        <div className="rounded-md border border-destructive/20 overflow-hidden">
                          <p className="px-2 py-1.5 text-[10px] font-display uppercase tracking-wider bg-destructive/10 text-destructive">
                            {t("adminUsageSessionErrors")}
                          </p>
                          <ul className="divide-y max-h-40 overflow-y-auto">
                            {session.errors.map((err, idx) => (
                              <li key={`${session.id}-err-${idx}`} className="px-2 py-1.5 text-xs">
                                <p className="font-medium truncate">{err.fileName || "—"}</p>
                                {err.errorCode ? (
                                  <p className="font-mono text-destructive">{err.errorCode}</p>
                                ) : null}
                                {err.errorMessage ? (
                                  <p className="text-muted-foreground line-clamp-2">{err.errorMessage}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`${adminPanelCardClass} space-y-3`}>
        <SectionTitle>{t("adminActivityLogTitle")}</SectionTitle>
        {loading && events.length === 0 ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-brand-red" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("adminActivityEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColWhen")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColType")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColFile")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColPages")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColDuration")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColDetail")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">
                      {formatDateTime(ev.at || null)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                          ev.type === "document_process_error"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : ev.type === "doc_processed"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                              : "border-border bg-muted/40"
                        }`}
                      >
                        {activityTypeLabel(ev.type, t)}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[180px]">
                      <span className="truncate block" title={ev.meta?.fileName || undefined}>
                        {ev.meta?.fileName || "—"}
                      </span>
                      {ev.meta?.fileSizeBytes != null ? (
                        <span className="text-[10px] text-muted-foreground">
                          {formatBytes(ev.meta.fileSizeBytes)}
                          {ev.meta.mimeType ? ` · ${ev.meta.mimeType}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {ev.meta?.pageCount ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDuration(ev.meta?.durationMs)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[240px]">
                      {ev.meta?.errorCode ? (
                        <span className="font-mono text-destructive">{ev.meta.errorCode}</span>
                      ) : null}
                      {ev.meta?.errorMessage ? (
                        <p className="mt-0.5 line-clamp-3" title={ev.meta.errorMessage}>
                          {ev.meta.errorMessage}
                        </p>
                      ) : !ev.meta?.errorCode ? (
                        "—"
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${adminPanelCardClass} space-y-3`}>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" />
            {t("adminActivityDocsTitle")}
          </span>
        </SectionTitle>
        <p className="text-xs text-muted-foreground">{t("adminActivityDocsHint")}</p>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("adminActivityDocsEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColFile")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminUsersColStatus")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColPages")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColWhen")}
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("adminActivityColDetail")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 max-w-[200px]">
                      <span className="truncate block font-medium" title={d.fileName || undefined}>
                        {d.fileName || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] ${
                          d.status === "error"
                            ? "border-destructive/40 text-destructive"
                            : "border-border"
                        }`}
                      >
                        {d.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {d.pageCount ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(d.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px]">
                      {d.errorCode ? <span className="font-mono">{d.errorCode}</span> : null}
                      {d.error ? (
                        <p className="line-clamp-2 mt-0.5" title={d.error}>
                          {d.error}
                        </p>
                      ) : !d.errorCode ? (
                        "—"
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  danger,
  small,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/80 px-3 py-2.5">
      <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-semibold ${small ? "text-xs truncate" : "text-lg tabular-nums"} ${
          danger ? "text-destructive" : "text-foreground"
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function BadgeSoft({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ok" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "ok"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${cls}`}>{children}</span>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
