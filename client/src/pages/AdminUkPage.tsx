import { lazy, Suspense, useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { SeoNoIndex } from "@/components/SeoNoIndex";
import { checkAdminUkSession, logoutAdminUk } from "@/lib/adminUkGateClient";
import { UkUatProvider } from "@/cafe/context/UkUatContext";
import { DashboardLoadingShell } from "@/cafe/components/DashboardLoadingShell";
import { Button } from "@/components/ui/button";
import { Flag, LogOut } from "lucide-react";

const PlatformPage = lazy(() => import("./PlatformPage"));

function useAdminUkGate(): { allowed: boolean; checking: boolean } {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkAdminUkSession().then((ok) => {
      if (!cancelled) {
        setAllowed(ok);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowed, checking };
}

/**
 * Password-gated UK UAT sandbox.
 * Same restaurant dashboard as /app, but tax region, currency (GBP), VAT rates,
 * and Gemini extraction prompts are forced to the UK fiscal system.
 */
export default function AdminUkPage() {
  const { theme } = useTheme();
  const { allowed, checking } = useAdminUkGate();

  useEffect(() => {
    if (!checking && !allowed) {
      window.location.href = `/admin-uk-gate?next=${encodeURIComponent("/admin-uk")}`;
    }
  }, [checking, allowed]);

  if (checking || !allowed) {
    return (
      <>
        <SeoNoIndex />
        <DashboardLoadingShell />
      </>
    );
  }

  return (
    <>
      <SeoNoIndex />
      <UkUatProvider active>
        <div
          className={`min-h-[100dvh] min-h-screen cafe-shell overscroll-y-contain ${
            theme === "dark" ? "cafe-theme-dark" : "cafe-theme-light"
          }`}
        >
          <div className="sticky top-0 z-[80] border-b border-amber-500/40 bg-amber-500/15 backdrop-blur-sm px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Flag className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Admin UK UAT</strong> — GBP · UK VAT 0% / 5% / 20% · UK Gemini · isolated Firestore{" "}
                <code className="text-xs">admin-uk-uat</code>. Not on production{" "}
                <code className="text-xs">/app</code> until you promote it.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => {
                void logoutAdminUk().then(() => {
                  window.location.href = "/admin-uk-gate";
                });
              }}
            >
              <LogOut className="size-3.5" />
              Exit UK UAT
            </Button>
          </div>
          <Suspense fallback={<DashboardLoadingShell />}>
            <PlatformPage />
          </Suspense>
        </div>
      </UkUatProvider>
    </>
  );
}
