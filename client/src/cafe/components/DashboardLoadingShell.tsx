/**
 * Skeleton shown while the dashboard chunk loads. Mirrors the real header H1 so LCP can
 * settle earlier with stable typography (reduces render-delay vs a tiny “Loading…” only).
 */
export function DashboardLoadingShell({ mode = "dashboard" }: { mode?: "dashboard" | "auth" }) {
  const title = mode === "auth" ? "…" : "Dashboard";
  return (
    <div className="min-h-[100dvh] min-h-screen bg-cdlp-dark flex flex-col md:flex-row touch-manipulation overscroll-y-contain">
      <div
        className="hidden md:block w-64 shrink-0 bg-cdlp-black border-r border-cdlp-border"
        aria-hidden
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 md:pl-8">
        <div className="flex items-center justify-between mb-6 min-h-[2.75rem]">
          <h1 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase">{title}</h1>
        </div>
        <div
          className="rounded-lg border border-cdlp-border bg-cdlp-black/20 min-h-[12rem] animate-pulse"
          aria-busy="true"
          aria-label={mode === "auth" ? "Loading" : "Loading dashboard"}
        />
      </div>
    </div>
  );
}
