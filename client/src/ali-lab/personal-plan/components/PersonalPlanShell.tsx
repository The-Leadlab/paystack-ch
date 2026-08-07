import type { ReactNode } from "react";
import { useState } from "react";
import "../personalPlan.css";
import { PersonalPlanProvider } from "../context/PersonalPlanContext";
import { PersonalPlanHeader } from "./PersonalPlanHeader";
import { PersonalPlanKpiStrip } from "./PersonalPlanKpiStrip";
import { PersonalPlanMobileNav, PersonalPlanSidebar } from "./PersonalPlanSidebar";
import { PersonalTransactionModal } from "./PersonalTransactionModal";
import { PersonalInviteModal } from "./PersonalInviteModal";
import { PersonalOnboardingWizard } from "./PersonalOnboardingWizard";
import { AliLabAuthBanner } from "../../components/AliLabAuthBanner";
import { personalAppHomePath, type PersonalPlanSurface } from "../personalPlanNav";
import {
  PERSONAL_SIDEBAR_COLLAPSED_KEY,
  usePersistedSidebarCollapsed,
} from "@/hooks/usePersistedSidebarCollapsed";
import {
  PERSONAL_ONBOARDING_KEY,
  readOnboardingDone,
} from "@/components/onboarding/OnboardingStepShell";
import {
  PERSONAL_TOUR_DONE_KEY,
  PERSONAL_TOUR_STEPS,
  ProductTourOverlay,
  useProductTour,
} from "@/components/product-tour";
import { cn } from "@/lib/utils";

function PersonalPlanShellInner({
  featureId,
  title,
  showKpi = true,
  surface = "lab",
  children,
}: {
  featureId: string | undefined;
  title?: string;
  showKpi?: boolean;
  surface?: PersonalPlanSurface;
  children: ReactNode;
}) {
  const personalHome = personalAppHomePath();
  const { collapsed, toggle } = usePersistedSidebarCollapsed(PERSONAL_SIDEBAR_COLLAPSED_KEY);
  const [showOnboarding, setShowOnboarding] = useState(
    () => surface === "app" && !readOnboardingDone(PERSONAL_ONBOARDING_KEY)
  );
  const tour = useProductTour({
    storageKey: PERSONAL_TOUR_DONE_KEY,
    steps: PERSONAL_TOUR_STEPS,
    enabled: surface === "app" && !showOnboarding,
    autoStartDelayMs: 800,
  });

  return (
    <div className="personal-plan-shell">
      {showOnboarding ? <PersonalOnboardingWizard onDone={() => setShowOnboarding(false)} /> : null}
      {tour.active && tour.current ? (
        <ProductTourOverlay
          step={tour.current}
          index={tour.index}
          total={tour.total}
          rect={tour.rect}
          onNext={tour.goNext}
          onBack={tour.goBack}
          onSkip={tour.skip}
        />
      ) : null}
      <PersonalPlanSidebar
        featureId={featureId}
        surface={surface}
        collapsed={collapsed}
        onToggleCollapsed={toggle}
      />
      <main
        className={cn(
          "min-h-screen pb-24 md:pb-8 transition-[margin] duration-200",
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {surface !== "app" ? (
          <AliLabAuthBanner
            variant="personal"
            signInRedirect={surface === "app" ? personalHome : "/ali/overview"}
          />
        ) : null}
        <PersonalPlanHeader title={title} />
        <div className="p-4 md:p-12 space-y-5 max-w-[1400px]">
          {showKpi ? <PersonalPlanKpiStrip /> : null}
          {children}
        </div>
      </main>
      <PersonalPlanMobileNav featureId={featureId} surface={surface} />
      <PersonalTransactionModal />
      {surface === "app" ? <PersonalInviteModal /> : null}
    </div>
  );
}

export function PersonalPlanShell(props: {
  featureId: string | undefined;
  title?: string;
  showKpi?: boolean;
  surface?: PersonalPlanSurface;
  children: ReactNode;
}) {
  return (
    <PersonalPlanProvider surface={props.surface ?? "lab"}>
      <PersonalPlanShellInner {...props} />
    </PersonalPlanProvider>
  );
}
