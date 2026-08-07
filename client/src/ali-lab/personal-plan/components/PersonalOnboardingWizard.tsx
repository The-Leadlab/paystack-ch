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

type Goal = "save" | "track" | "both" | null;

const STEPS = 5;

export function PersonalOnboardingWizard({ onDone }: { onDone: () => void }) {
  const { openInvite, surface } = usePersonalPlan();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>(null);
  const [busy, setBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  const finish = () => {
    try {
      window.localStorage.setItem(
        PERSONAL_ONBOARDING_PREFS_KEY,
        JSON.stringify({ goal, driveConnected, at: new Date().toISOString() })
      );
    } catch {
      /* ignore */
    }
    writeOnboardingDone(PERSONAL_ONBOARDING_KEY);
    onDone();
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
        onSkip={finish}
      >
        <p className="text-xs text-white/50">Bank statements, budgets, and goals stay separate from Business.</p>
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
        onSkip={finish}
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
        <div className="rounded-xl border border-white/15 px-4 py-3 flex items-center gap-3 text-sm">
          <Cloud className="size-5 text-white/70" />
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
        <div className="rounded-xl border border-white/15 px-4 py-3 flex items-center gap-3 text-sm">
          <UserPlus className="size-5 text-white/70" />
          One free seat on Personal — extras are billed as add-ons.
        </div>
      </OnboardingStepShell>
    );
  }
  return (
    <OnboardingStepShell
      stepIndex={4}
      stepCount={STEPS}
      title="Upload a bank statement"
      subtitle="CSV or PDF on Overview — AI fills categories when available."
      primaryLabel="Go to Overview"
      onPrimary={finish}
      onSkip={finish}
    >
      <div className="rounded-xl border border-white/15 px-4 py-3 flex items-center gap-3 text-sm">
        <Upload className="size-5 text-white/70" />
        You can upload anytime from Overview.
      </div>
    </OnboardingStepShell>
  );
}
