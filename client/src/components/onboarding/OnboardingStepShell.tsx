import type { ReactNode } from "react";

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

/** Apollo-style fullscreen onboarding step. */
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
  return (
    <div className="fixed inset-0 z-[80] bg-[#0c0e12] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/90 flex items-center justify-center font-bold">P</div>
          <span className="text-sm font-semibold tracking-tight">Paystack</span>
        </div>
        <span className="text-[11px] text-white/50 uppercase tracking-wider">
          {stepIndex + 1} / {stepCount}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-10 md:py-16">
        <div className="max-w-xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-3 text-sm text-white/60 leading-relaxed">{subtitle}</p> : null}
          </div>
          {children}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={onPrimary}
              className="h-11 px-6 rounded-full bg-white text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90"
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="h-11 px-4 text-sm font-semibold text-white/70 hover:text-white"
            >
              Skip for now
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
        selected
          ? "border-white bg-white/10"
          : "border-white/15 hover:border-white/40 bg-white/[0.03]"
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="text-xs text-white/55 mt-1">{description}</p> : null}
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
