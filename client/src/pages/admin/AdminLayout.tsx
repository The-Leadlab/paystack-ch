import type { ReactNode } from "react";
import { Link } from "wouter";
import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/cafe/context/LanguageContext";

type AdminLayoutProps = {
  children: ReactNode;
  heading: string;
  description?: string;
};

/** Full-width shell for /admin — not the narrow auth sign-in column. */
export function AdminLayout({ children, heading, description }: AdminLayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-[100dvh] min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-[oklch(0.97_0.01_85)] text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto flex items-center justify-between gap-4 py-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <BrandLogo href="/" markClassName="h-9 w-auto object-contain shrink-0" />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="min-w-0">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">
                {t("adminLayoutEyebrow")}
              </p>
              <h1 className="font-display text-lg sm:text-xl font-bold truncate">{heading}</h1>
            </div>
          </div>
          <Link
            href="/"
            className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {t("authBackHome")}
          </Link>
        </div>
      </header>

      <main className="flex-1 container max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {description ? (
          <p className="font-editorial text-sm text-muted-foreground mb-6 max-w-3xl">{description}</p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
