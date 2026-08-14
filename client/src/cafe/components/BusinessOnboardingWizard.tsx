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

const STEPS = 5;

export function BusinessOnboardingWizard({
  onDone,
}: {
  onDone: (tourLength: TourLength) => void;
}) {
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
        title="Welcome to Paystack Business"
        subtitle="Swiss restaurant finances — sessions, documents, revenue, and VAT."
        primaryLabel="Continue"
        onPrimary={() => setStep(1)}
        onSkip={() => finish("skip")}
      >
        <p className="text-xs text-[color:var(--color-cdlp-muted)]">Personal money stays on /personal — never mixed into Revenue.</p>
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
        onSkip={() => finish("skip")}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <Store className="size-5 text-[color:var(--color-cdlp-muted)]" />
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
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <Cloud className="size-5 text-[color:var(--color-cdlp-muted)]" />
          {driveConnected ? "Drive connected" : "Reconnect anytime from Billing / Settings."}
        </div>
      </OnboardingStepShell>
    );
  }
  if (step === 3) {
    return (
      <OnboardingStepShell
        stepIndex={3}
        stepCount={STEPS}
        title="Create your first session"
        subtitle="Sessions organize documents and ledgers by period. Use New session in the sidebar."
        primaryLabel="Continue"
        onPrimary={() => setStep(4)}
        onSkip={() => setStep(4)}
      >
        <div className="rounded-xl border border-[color:var(--color-cdlp-border)] bg-[color:var(--color-cdlp-card)] px-4 py-3 flex items-center gap-3 text-sm">
          <FolderKanban className="size-5 text-[color:var(--color-cdlp-muted)]" />
          Tip: collapse the sidebar — only icons remain and the dashboard grows.
        </div>
      </OnboardingStepShell>
    );
  }
  return (
    <OnboardingStepShell
      stepIndex={4}
      stepCount={STEPS}
      title="Product tour?"
      subtitle="Short covers the essentials. Long walks every tab and the features inside."
      primaryLabel="Open dashboard"
      primaryDisabled={!tourLength}
      onPrimary={() => finish(tourLength || "short")}
      onSkip={() => finish("skip")}
    >
      <div className="space-y-2">
        <ChoiceCard
          selected={tourLength === "short"}
          title="Short tutorial"
          description="Sessions, Dashboard, Documents, sidebar (~1 min)"
          onClick={() => setTourLength("short")}
        />
        <ChoiceCard
          selected={tourLength === "long"}
          title="Long tutorial"
          description="Each tab (Revenue, Expenses, Invoices, Reports…) plus in-page features"
          onClick={() => setTourLength("long")}
        />
        <ChoiceCard
          selected={tourLength === "skip"}
          title="No tutorial"
          description="Go straight in — restart anytime from the sidebar"
          onClick={() => setTourLength("skip")}
        />
      </div>
    </OnboardingStepShell>
  );
}
