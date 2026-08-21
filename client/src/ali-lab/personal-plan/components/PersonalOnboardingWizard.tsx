import { useState } from "react";
import { Cloud, Upload, UserPlus } from "lucide-react";
import {
  ChoiceCard,
  OnboardingStepShell,
  PERSONAL_ONBOARDING_KEY,
  PERSONAL_ONBOARDING_PREFS_KEY,
  writeOnboardingDone,
} from "@/components/onboarding/OnboardingStepShell";
import { usePersonalPlan } from "@/ali-lab/personal-plan/context/PersonalPlanContext";
import {
  connectGoogleDrive,
  fetchGoogleDriveStatus,
} from "@/cafe/lib/googleDriveClient";
import { personalAppHomePath } from "@/ali-lab/personal-plan/personalPlanNav";
import {
  PERSONAL_TOUR_DONE_KEY,
  PERSONAL_TOUR_LENGTH_KEY,
  type TourLength,
  writeTourDone,
  writeTourLength,
} from "@/components/product-tour";
import { useLanguage } from "@/cafe/context/LanguageContext";

type Goal = "save" | "track" | "both" | null;

const STEPS = 6;

export function PersonalOnboardingWizard({
  onDone,
}: {
  onDone: (tourLength: TourLength) => void;
}) {
  const { t } = useLanguage();
  const { openInvite, surface } = usePersonalPlan();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>(null);
  const [busy, setBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [tourLength, setTourLength] = useState<TourLength | null>(null);

  const finish = (length: TourLength) => {
    try {
      window.localStorage.setItem(
        PERSONAL_ONBOARDING_PREFS_KEY,
        JSON.stringify({ goal, driveConnected, tourLength: length, at: new Date().toISOString() })
      );
    } catch {
      /* ignore */
    }
    writeTourLength(PERSONAL_TOUR_LENGTH_KEY, length);
    if (length === "skip") writeTourDone(PERSONAL_TOUR_DONE_KEY);
    writeOnboardingDone(PERSONAL_ONBOARDING_KEY);
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
      await connectGoogleDrive(personalAppHomePath());
    } catch {
      /* user can skip */
    } finally {
      setBusy(false);
    }
  };

  if (step === 0) {
    return (
      <OnboardingStepShell
        stepIndex={0}
        stepCount={STEPS}
        title="Welcome to Paystack Personal"
        subtitle="Set up your household money view in a minute — or skip and explore."
        primaryLabel="Continue"
        onPrimary={() => setStep(1)}
        onSkip={() => finish("skip")}
      >
        <p className="text-xs text-[color:var(--color-cdlp-muted)]">Bank statements, budgets, and goals stay separate from Business.</p>
      </OnboardingStepShell>
    );
  }
  if (step === 1) {
    return (
      <OnboardingStepShell
        stepIndex={1}
        stepCount={STEPS}
        title="What do you want to focus on?"
        subtitle="We’ll highlight the right tabs after you choose."
        primaryLabel="Continue"
        primaryDisabled={!goal}
        onPrimary={() => setStep(2)}
        onSkip={() => finish("skip")}
      >
        <div className="space-y-2">
          <ChoiceCard
            selected={goal === "save"}
            title="Save more"
            description="Goals and surplus coaching"
            onClick={() => setGoal("save")}
          />
          <ChoiceCard
            selected={goal === "track"}
            title="Track spending"
            description="Budgets and category limits"
            onClick={() => setGoal("track")}
          />
          <ChoiceCard
            selected={goal === "both"}
            title="Both"
            description="Full personal toolkit"
            onClick={() => setGoal("both")}
          />
        </div>
      </OnboardingStepShell>
    );
  }
  if (step === 2) {
    return (
      <OnboardingStepShell
        stepIndex={2}
        stepCount={STEPS}
        title="Connect Google Drive"
        subtitle="Optional. Statement backups go under Paystack Documents / Personal / date."
        primaryLabel={driveConnected ? "Continue" : busy ? "Connecting…" : "Connect Drive"}
        primaryDisabled={busy}
        onPrimary={() => {
          if (driveConnected) setStep(3);
          else void connectDrive().then(() => setStep(3));
        }}
        onSkip={() => setStep(3)}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <Cloud className="size-5 text-[color:var(--color-cdlp-muted)]" />
          {driveConnected ? "Drive connected" : "Same Google account as Business Drive is fine."}
        </div>
      </OnboardingStepShell>
    );
  }
  if (step === 3) {
    return (
      <OnboardingStepShell
        stepIndex={3}
        stepCount={STEPS}
        title="Invite household?"
        subtitle="Editors can help with budgets; viewers can see the shared wallet."
        primaryLabel={surface === "app" ? "Open invite" : "Continue"}
        onPrimary={() => {
          if (surface === "app") openInvite();
          setStep(4);
        }}
        onSkip={() => setStep(4)}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <UserPlus className="size-5 text-[color:var(--color-cdlp-muted)]" />
          One free seat on Personal — extras are billed as add-ons.
        </div>
      </OnboardingStepShell>
    );
  }
  if (step === 4) {
    return (
      <OnboardingStepShell
        stepIndex={4}
        stepCount={STEPS}
        title="Upload a bank statement"
        subtitle="CSV or PDF on Overview — AI fills categories when available."
        primaryLabel="Continue"
        onPrimary={() => setStep(5)}
        onSkip={() => setStep(5)}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <Upload className="size-5 text-[color:var(--color-cdlp-muted)]" />
          You can upload anytime from Overview.
        </div>
      </OnboardingStepShell>
    );
  }
  return (
    <OnboardingStepShell
      stepIndex={5}
      stepCount={STEPS}
      title={t("tourChoiceTitle")}
      subtitle={t("tourChoiceSubtitlePersonal")}
      primaryLabel={tourLength === "skip" ? t("tourChoiceOpenOverview") : t("tourChoiceStartTour")}
      primaryDisabled={!tourLength}
      onPrimary={() => finish(tourLength || "short")}
      onSkip={() => finish("skip")}
    >
      <div className="space-y-2">
        <ChoiceCard
          selected={tourLength === "short"}
          title={t("tourChoiceShortTitle")}
          description={t("tourChoiceShortDescPersonal")}
          onClick={() => setTourLength("short")}
        />
        <ChoiceCard
          selected={tourLength === "long"}
          title={t("tourChoiceLongTitle")}
          description={t("tourChoiceLongDescPersonal")}
          onClick={() => setTourLength("long")}
        />
        <ChoiceCard
          selected={tourLength === "skip"}
          title={t("tourChoiceSkipTitle")}
          description={t("tourChoiceSkipDescPersonal")}
          onClick={() => setTourLength("skip")}
        />
      </div>
    </OnboardingStepShell>
  );
}
