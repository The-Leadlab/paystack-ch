import { cn } from "@/lib/utils";
import {
  OnboardingLanguageToggle,
} from "@/components/onboarding/OnboardingStepShell";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { TourRect } from "./useProductTour";
import type { TourStep } from "./tourSteps";

type Props = {
  step: TourStep;
  index: number;
  total: number;
  rect: TourRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const PAD = 8;

export function ProductTourOverlay({
  step,
  index,
  total,
  rect,
  onNext,
  onBack,
  onSkip,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const dark = theme === "dark";

  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const popoverStyle = (() => {
    if (!hole) {
      return { top: "30%", left: "50%", transform: "translateX(-50%)" } as const;
    }
    const below = hole.top + hole.height + 12;
    const spaceBelow = window.innerHeight - below;
    const top = Math.min(
      Math.max(12, spaceBelow > 180 ? below : hole.top - 160),
      window.innerHeight - 220,
    );
    const left = Math.min(
      Math.max(12, hole.left),
      Math.max(12, window.innerWidth - 320),
    );
    return { top, left };
  })();

  return (
    <div
      className={cn(
        /* Above ThemeToggle (z-100) and onboarding (z-110) so Next / Skip always receive taps */
        "fixed inset-0 z-[120] cafe-shell pointer-events-auto",
        dark ? "cafe-theme-dark" : "cafe-theme-light",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t("tourAriaLabel")}
      style={{ fontFamily: "var(--font-app), system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      {/* Backdrop does NOT skip — accidental taps were eating Next on some phones */}
      <div className="absolute inset-0 z-0 bg-black/55 pointer-events-none" aria-hidden />
      {hole ? (
        <div
          className="absolute z-[1] rounded-xl ring-2 ring-[color:var(--color-cdlp-gold)] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : null}
      <div
        className={cn(
          "absolute z-[2] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border p-4 shadow-xl pointer-events-auto",
          "bg-[color:var(--color-cdlp-card)] border-[color:var(--color-cdlp-border)]",
          "text-[color:var(--color-cdlp-muted)]",
        )}
        style={popoverStyle}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-cdlp-muted)]">
            {index + 1} / {total}
          </p>
          <OnboardingLanguageToggle className="h-8 px-2.5" />
        </div>
        <h2
          className={cn(
            "text-sm font-bold",
            dark ? "text-white" : "text-[color:var(--color-brand-charcoal,#2B2B2B)]",
          )}
        >
          {t(step.titleKey)}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-cdlp-muted)]">
          {t(step.bodyKey)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 relative z-10">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNext();
            }}
            className="h-9 px-4 rounded-lg bg-[color:var(--color-cdlp-gold)] text-white text-xs font-bold hover:bg-[color:var(--color-cdlp-gold-light)] transition-colors touch-manipulation"
          >
            {index >= total - 1 ? t("tourDone") : t("tourNext")}
          </button>
          {index > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBack();
              }}
              className="h-9 px-3 text-xs font-semibold text-[color:var(--color-cdlp-muted)] hover:text-[color:var(--color-cdlp-gold)] touch-manipulation"
            >
              {t("tourBack")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSkip();
            }}
            className="h-9 px-3 ml-auto text-xs font-semibold text-[color:var(--color-cdlp-muted)] hover:text-[color:var(--color-cdlp-gold)] touch-manipulation"
          >
            {t("tourSkip")}
          </button>
        </div>
      </div>
    </div>
  );
}
