import { useLanguage } from "../context/LanguageContext";

/**
 * Skeleton shown while the dashboard chunk loads. Mirrors the real header H1 so LCP can
 * settle earlier with stable typography (reduces render-delay vs a tiny “Loading…” only).
 */
export function DashboardLoadingShell({ mode = "dashboard" }: { mode?: "dashboard" | "auth" }) {
  const { t } = useLanguage();
  const title = mode === "auth" ? "…" : t("dashboard");
  return (
    <div
      className="min-h-[100dvh] min-h-screen bg-cdlp-dark flex flex-col md:flex-row touch-manipulation overscroll-y-contain"
      aria-busy="true"
      aria-label={t("appLoading")}
    >
      <div
        className="hidden md:block w-64 shrink-0 bg-cdlp-black border-r border-cdlp-border"
        aria-hidden
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 md:pl-8">
        <div className="flex items-center justify-between min-h-[2.75rem]">
          <p className="text-xl md:text-2xl font-black text-white uppercase m-0">{title}</p>
        </div>
      </div>
    </div>
  );
}
