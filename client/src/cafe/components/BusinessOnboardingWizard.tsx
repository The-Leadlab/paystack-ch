import { useState } from "react";
import { Cloud, FolderKanban, Store } from "lucide-react";
import {
  OnboardingStepShell,
  BUSINESS_ONBOARDING_KEY,
  writeOnboardingDone,
} from "@/components/onboarding/OnboardingStepShell";
import {
  connectGoogleDrive,
  fetchGoogleDriveStatus,
} from "@/cafe/lib/googleDriveClient";

const STEPS = 4;

export function BusinessOnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  const finish = () => {
    writeOnboardingDone(BUSINESS_ONBOARDING_KEY);
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
        title="Welcome to Paystack Business"
        subtitle="Swiss restaurant finances — sessions, documents, revenue, and VAT."
        primaryLabel="Continue"
        onPrimary={() => setStep(1)}
        onSkip={finish}
      >
        <p className="text-xs text-white/50">Personal money stays on /personal — never mixed into Revenue.</p>
      </OnboardingStepShell>
    );
  }
  if (step === 1) {
    return (
      <OnboardingStepShell
        stepIndex={1}
        stepCount={STEPS}
        title="Your restaurant workspace"
        subtitle="If you already picked a client, you’re set. Otherwise create one from the client list."
        primaryLabel="Continue"
        onPrimary={() => setStep(2)}
        onSkip={finish}
      >
        <div className="rounded-xl border border-white/15 px-4 py-3 flex items-center gap-3 text-sm">
          <Store className="size-5 text-white/70" />
          Client / restaurant selection stays available after setup.
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
        subtitle="Optional. Business documents sync under Paystack Documents."
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
          {driveConnected ? "Drive connected" : "Reconnect anytime from Billing / Settings."}
        </div>
      </OnboardingStepShell>
    );
  }
  return (
    <OnboardingStepShell
      stepIndex={3}
      stepCount={STEPS}
      title="Create your first session"
      subtitle="Sessions organize documents and ledgers by period. Use New session in the sidebar."
      primaryLabel="Open dashboard"
      onPrimary={finish}
      onSkip={finish}
    >
      <div className="rounded-xl border border-white/15 px-4 py-3 flex items-center gap-3 text-sm">
        <FolderKanban className="size-5 text-white/70" />
        Tip: collapse the sidebar with the rail button when you need more space.
      </div>
    </OnboardingStepShell>
  );
}
