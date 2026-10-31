import { lazy, Suspense, useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { SeoNoIndex } from "@/components/SeoNoIndex";
import { checkAdminUkSession, logoutAdminUk } from "@/lib/adminUkGateClient";
import { UkUatProvider } from "@/cafe/context/UkUatContext";
import { DashboardLoadingShell } from "@/cafe/components/DashboardLoadingShell";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Flag, LogOut } from "lucide-react";
import { retryingImport } from "@/lib/chunkLoadRecovery";

const PlatformPage = lazy(retryingImport(() => import("./PlatformPage")));

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
  const { t } = useLanguage();
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
          <div className="sticky top-0 z-[80] border-b border-amber-500/40 bg-amber-500/15 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium min-w-0">
              <Flag className="size-3.5 sm:size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="sm:hidden truncate">
                <strong>{t("adminUkBannerShort")}</strong>
              </span>
              <span className="hidden sm:inline leading-snug">
                <strong>{t("adminUkBannerTitle")}</strong>
                {" — "}
                {t("adminUkBannerBody")}{" "}
                <code className="text-xs">admin-uk-uat</code>. {t("adminUkBannerNotProd")}{" "}
                <code className="text-xs">/app</code>.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0 h-8 min-h-8 px-2.5"
              onClick={() => {
                void logoutAdminUk().then(() => {
                  window.location.href = "/admin-uk-gate";
                });
              }}
            >
              <LogOut className="size-3.5" />
              <span className="sm:hidden">{t("adminUkExitShort")}</span>
              <span className="hidden sm:inline">{t("adminUkExit")}</span>
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
