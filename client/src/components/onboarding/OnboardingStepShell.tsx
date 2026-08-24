import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onSkip: () => void;
  stepIndex: number;
  stepCount: number;
};

/** Compact theme control for onboarding / tour chrome (not the floating FAB). */
export function OnboardingThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, switchable } = useTheme();
  const { t } = useLanguage();
  if (!switchable || !toggleTheme) return null;
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors",
        "border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] text-[color:var(--color-cdlp-muted)]",
        "hover:text-[color:var(--color-cdlp-gold)] hover:border-[color:var(--color-cdlp-gold)]",
        className,
      )}
      aria-label={dark ? t("themeAriaLight") : t("themeAriaDark")}
      title={dark ? t("themeTitleLight") : t("themeTitleDark")}
    >
      {dark ? <Sun className="size-3.5 shrink-0" /> : <Moon className="size-3.5 shrink-0" />}
      <span className="hidden sm:inline">{dark ? t("themeLabelLight") : t("themeLabelDark")}</span>
    </button>
  );
}

/**
 * Fullscreen onboarding step — same café palette / typography as `/app` dashboard.
 * Follows light/dark via ThemeProvider (`cafe-theme-*` + BrandLogo on-dark assets).
 */
export function OnboardingStepShell({
  title,
  subtitle,
  children,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  onSkip,
  stepIndex,
  stepCount,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const dark = theme === "dark";

  return (
    <div
      className={cn(
        /* Above global ThemeToggle (z-100) and tour overlay (z-90) so Continue / Skip always receive clicks */
        "fixed inset-0 z-[110] flex flex-col cafe-shell overscroll-y-contain pointer-events-auto",
        dark ? "cafe-theme-dark" : "cafe-theme-light",
        "bg-[color:var(--color-cdlp-black)] text-[color:var(--color-cdlp-muted)]",
      )}
      style={{ fontFamily: "var(--font-app), system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-title"
    >
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-black)]/95 backdrop-blur-sm">
        <BrandLogo
          href=""
          showWordmark
          markClassName="h-8 sm:h-9 w-auto object-contain shrink-0 max-w-[160px]"
          className="min-w-0"
        />
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <OnboardingThemeToggle />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-cdlp-muted)] tabular-nums">
            {stepIndex + 1} / {stepCount}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 md:py-14">
        <div className="max-w-xl mx-auto space-y-6">
          <div>
            <h1
              id="onboarding-step-title"
              className={cn(
                "text-2xl md:text-3xl font-bold tracking-tight",
                dark ? "text-white" : "text-[color:var(--color-brand-charcoal,#2B2B2B)]",
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-cdlp-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <div className="space-y-4">{children}</div>
          <div className="flex flex-wrap items-center gap-3 pt-4 relative z-10">
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPrimary();
              }}
              className={cn(
                "h-11 px-6 rounded-lg text-sm font-bold text-white transition-colors",
                "bg-[color:var(--color-cdlp-gold)] hover:bg-[color:var(--color-cdlp-gold-light)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSkip();
              }}
              className="h-11 px-4 text-sm font-semibold text-[color:var(--color-cdlp-muted)] hover:text-[color:var(--color-cdlp-gold)] transition-colors"
            >
              {t("onboardingSkip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChoiceCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border px-4 py-3 transition-colors",
        selected
          ? "border-[color:var(--color-cdlp-gold)] bg-[color:var(--color-cdlp-gold)]/10"
          : "border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] hover:border-[color:var(--color-cdlp-gold)]/50",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          dark ? "text-white" : "text-[color:var(--color-brand-charcoal,#2B2B2B)]",
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="text-xs text-[color:var(--color-cdlp-muted)] mt-1">{description}</p>
      ) : null}
    </button>
  );
}

export function readOnboardingDone(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingDone(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function resetOnboardingDone(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const PERSONAL_ONBOARDING_KEY = "paystack-personal-onboarding-done";
export const BUSINESS_ONBOARDING_KEY = "paystack-business-onboarding-done";
export const PERSONAL_ONBOARDING_PREFS_KEY = "paystack-personal-onboarding-prefs";
