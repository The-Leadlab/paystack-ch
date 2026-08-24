import { useState } from "react";
import { Cloud, FolderKanban, Store } from "lucide-react";
import {
  ChoiceCard,
  OnboardingStepShell,
  BUSINESS_ONBOARDING_KEY,
  writeOnboardingDone,
} from "@/components/onboarding/OnboardingStepShell";
import {
  connectGoogleDrive,
  fetchGoogleDriveStatus,
} from "@/cafe/lib/googleDriveClient";
import {
  BUSINESS_TOUR_DONE_KEY,
  BUSINESS_TOUR_LENGTH_KEY,
  type TourLength,
  writeTourDone,
  writeTourLength,
} from "@/components/product-tour";
import { useLanguage } from "@/cafe/context/LanguageContext";

const STEPS = 5;

export function BusinessOnboardingWizard({
  onDone,
}: {
  onDone: (tourLength: TourLength) => void;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [tourLength, setTourLength] = useState<TourLength | null>(null);

  const finish = (length: TourLength) => {
    writeTourLength(BUSINESS_TOUR_LENGTH_KEY, length);
    if (length === "skip") writeTourDone(BUSINESS_TOUR_DONE_KEY);
    writeOnboardingDone(BUSINESS_ONBOARDING_KEY);
    onDone(length);
  };

  const connectDrive = async () => {
    setBusy(true);
    try {
      const status = await fetchGoogleDriveStatus();
      if (status.connected && !status.needsReconnect) {
        setDriveConnected(true);
        return;
      }
      await connectGoogleDrive("/app");
    } catch {
      /* skip ok */
    } finally {
      setBusy(false);
    }
  };

  if (step === 0) {
    return (
      <OnboardingStepShell
        stepIndex={0}
        stepCount={STEPS}
        title={t("bizOnboardWelcomeTitle")}
        subtitle={t("bizOnboardWelcomeSubtitle")}
        primaryLabel={t("onboardingContinue")}
        onPrimary={() => setStep(1)}
        onSkip={() => finish("skip")}
      >
        <p className="text-xs text-[color:var(--color-cdlp-muted)]">{t("bizOnboardWelcomeNote")}</p>
      </OnboardingStepShell>
    );
  }
  if (step === 1) {
    return (
      <OnboardingStepShell
        stepIndex={1}
        stepCount={STEPS}
        title={t("bizOnboardWorkspaceTitle")}
        subtitle={t("bizOnboardWorkspaceSubtitle")}
        primaryLabel={t("onboardingContinue")}
        onPrimary={() => setStep(2)}
        onSkip={() => finish("skip")}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <Store className="size-5 text-[color:var(--color-cdlp-muted)]" />
          {t("bizOnboardWorkspaceCard")}
        </div>
      </OnboardingStepShell>
    );
  }
  if (step === 2) {
    return (
      <OnboardingStepShell
        stepIndex={2}
        stepCount={STEPS}
        title={t("bizOnboardDriveTitle")}
        subtitle={t("bizOnboardDriveSubtitle")}
        primaryLabel={
          driveConnected
            ? t("onboardingContinue")
            : busy
              ? t("onboardingConnecting")
              : t("onboardingConnectDrive")
        }
        primaryDisabled={busy}
        onPrimary={() => {
          if (driveConnected) setStep(3);
          else void connectDrive().then(() => setStep(3));
        }}
        onSkip={() => setStep(3)}
      >
        <div className="space-y-2">
          <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
            <Cloud className="size-5 text-[color:var(--color-cdlp-muted)]" />
            {driveConnected ? t("onboardingDriveConnected") : t("bizOnboardDriveHint")}
          </div>
          {!driveConnected ? (
            <p className="text-xs text-[color:var(--color-cdlp-muted)] leading-relaxed px-1">
              {t("bizOnboardDriveUnverified")}
            </p>
          ) : null}
        </div>
      </OnboardingStepShell>
    );
  }
  if (step === 3) {
    return (
      <OnboardingStepShell
        stepIndex={3}
        stepCount={STEPS}
        title={t("bizOnboardSessionTitle")}
        subtitle={t("bizOnboardSessionSubtitle")}
        primaryLabel={t("onboardingContinue")}
        onPrimary={() => setStep(4)}
        onSkip={() => setStep(4)}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <FolderKanban className="size-5 text-[color:var(--color-cdlp-muted)]" />
          {t("bizOnboardSessionTip")}
        </div>
      </OnboardingStepShell>
    );
  }
  return (
    <OnboardingStepShell
      stepIndex={4}
      stepCount={STEPS}
      title={t("tourChoiceTitle")}
      subtitle={t("tourChoiceSubtitleBiz")}
      primaryLabel={t("tourChoiceOpenDashboard")}
      primaryDisabled={!tourLength}
      onPrimary={() => finish(tourLength || "short")}
      onSkip={() => finish("skip")}
    >
      <div className="space-y-2">
        <ChoiceCard
          selected={tourLength === "short"}
          title={t("tourChoiceShortTitle")}
          description={t("tourChoiceShortDescBiz")}
          onClick={() => setTourLength("short")}
        />
        <ChoiceCard
          selected={tourLength === "long"}
          title={t("tourChoiceLongTitle")}
          description={t("tourChoiceLongDescBiz")}
          onClick={() => setTourLength("long")}
        />
        <ChoiceCard
          selected={tourLength === "skip"}
          title={t("tourChoiceSkipTitle")}
          description={t("tourChoiceSkipDescBiz")}
          onClick={() => setTourLength("skip")}
        />
      </div>
    </OnboardingStepShell>
  );
}
