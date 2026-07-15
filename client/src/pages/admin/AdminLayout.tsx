import type { ReactNode } from "react";
import { Link } from "wouter";
import { Home, Shield } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageToggleButton } from "@/components/LanguageToggleButton";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

type AdminLayoutProps = {
  children: ReactNode;
  heading: string;
  description?: string;
};

/** Full-width shell for /admin — mobile-first sticky header and readable touch targets. */
export function AdminLayout({ children, heading, description }: AdminLayoutProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <div
      className={`min-h-[100dvh] min-h-screen flex flex-col text-foreground touch-manipulation ${
        theme === "dark"
          ? "bg-background"
          : "bg-gradient-to-br from-background via-background to-[oklch(0.97_0.01_85)]"
      }`}
    >
      <header className="border-b border-border/60 bg-background/95 backdrop-blur-md sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <BrandLogo href="/" markClassName="h-8 sm:h-9 w-auto object-contain shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <LanguageToggleButton />
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-1.5 h-10 min-h-10 sm:h-9 sm:min-h-9 px-3 rounded-lg border border-border bg-background/90 font-display text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                title={t("authBackHome")}
              >
                <Home className="size-4 shrink-0 sm:hidden" aria-hidden />
                <span className="hidden sm:inline text-sm">{t("authBackHome")}</span>
                <span className="sm:hidden font-semibold">{t("authBackHomeShort")}</span>
              </Link>
            </div>
          </div>
          <div className="min-w-0 pb-0.5 sm:pb-0 border-t border-border/40 pt-3 sm:border-0 sm:pt-0">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">
              {t("adminLayoutEyebrow")}
            </p>
            <h1 className="font-display text-base sm:text-xl font-bold leading-snug mt-0.5">{heading}</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {description ? (
          <p className="font-editorial text-sm text-muted-foreground mb-4 sm:mb-6 max-w-3xl leading-relaxed">
            {description}
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
