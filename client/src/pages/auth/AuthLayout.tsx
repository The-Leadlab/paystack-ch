import type { ReactNode } from "react";
import { Link } from "wouter";
import { Shield } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageToggleButton } from "@/components/LanguageToggleButton";
import { useLanguage } from "@/cafe/context/LanguageContext";

type AuthLayoutProps = {
  children: ReactNode;
  heading: string;
  description?: string;
  showFooterSecure?: boolean;
  /** Subtle top-right link to `/operator` (sign-in / sign-up only). */
  showAdminEntry?: boolean;
};

export function AuthLayout({
  children,
  heading,
  description,
  showFooterSecure = true,
  showAdminEntry = false,
}: AuthLayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-[100dvh] min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-[oklch(0.97_0.01_85)] text-foreground touch-manipulation overscroll-y-contain">
      <header className="container flex items-center justify-between gap-3 pt-[max(2rem,env(safe-area-inset-top)+1rem)] pb-4">
        <BrandLogo href="/" markClassName="h-11 w-auto object-contain shrink-0" />
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {showAdminEntry ? (
            <Link
              href="/operator?next=%2Fadmin"
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/30 bg-background/70 backdrop-blur-sm px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground hover:border-brand-red/45 hover:text-brand-red hover:bg-brand-red/[0.04] transition-colors shadow-sm"
            >
              <Shield className="size-3 shrink-0 opacity-75" aria-hidden />
              <span>{t("navSignInExisting")}</span>
            </Link>
          ) : null}
          <LanguageToggleButton />
          <Link
            href="/"
            className="hidden sm:inline font-display text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("authBackHome")}
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-[max(4rem,env(safe-area-inset-bottom)+2rem)]">
        <div className="w-full max-w-md">
          <p className="font-data text-xs text-muted-foreground uppercase tracking-[0.2em] text-center mb-2">
            {t("authTagline")}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-center mb-2">{heading}</h1>
          {description ? (
            <p className="font-editorial text-sm text-muted-foreground text-center mb-8">{description}</p>
          ) : (
            <div className="mb-8" />
          )}
          {children}
          {showFooterSecure ? (
            <p className="mt-8 text-center font-display text-xs text-muted-foreground">{t("authFooterSecure")}</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
