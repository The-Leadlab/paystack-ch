import type { ReactNode } from "react";
import { Link } from "wouter";
import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/cafe/context/LanguageContext";

type AuthLayoutProps = {
  children: ReactNode;
  heading: string;
  description?: string;
};

export function AuthLayout({ children, heading, description }: AuthLayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-[oklch(0.97_0.01_85)] text-foreground">
      <header className="container flex items-center justify-between pt-8 pb-4">
        <BrandLogo href="/" markClassName="h-11 w-auto object-contain shrink-0" />
        <Link
          href="/"
          className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("authBackHome")}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <p className="font-data text-xs text-muted-foreground uppercase tracking-[0.2em] text-center mb-2">
            {t("authTagline")}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-center mb-2">{heading}</h1>
          {description ? (
            <p className="font-editorial text-sm text-muted-foreground text-center mb-8">
              {description}
            </p>
          ) : (
            <div className="mb-8" />
          )}
          {children}
          <p className="mt-8 text-center font-display text-xs text-muted-foreground">
            {t("authFooterSecure")}
          </p>
        </div>
      </main>
    </div>
  );
}
