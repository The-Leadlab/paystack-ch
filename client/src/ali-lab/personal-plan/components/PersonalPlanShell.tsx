import type { ReactNode } from "react";
import "../personalPlan.css";
import { PersonalPlanProvider } from "../context/PersonalPlanContext";
import { PersonalPlanHeader } from "./PersonalPlanHeader";
import { PersonalPlanKpiStrip } from "./PersonalPlanKpiStrip";
import { PersonalPlanMobileNav, PersonalPlanSidebar } from "./PersonalPlanSidebar";
import { PersonalTransactionModal } from "./PersonalTransactionModal";
import { PersonalBillingAddons } from "./PersonalBillingAddons";
import { PersonalInviteModal } from "./PersonalInviteModal";
import { AliLabAuthBanner } from "../../components/AliLabAuthBanner";
import { personalAppHomePath, type PersonalPlanSurface } from "../personalPlanNav";

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
  const showOverviewExtras = surface === "app" && featureId === "overview";

  return (
    <div className="personal-plan-shell">
      <PersonalPlanSidebar featureId={featureId} surface={surface} />
      <main className="md:ml-64 min-h-screen pb-24 md:pb-8">
        {surface !== "app" ? (
          <AliLabAuthBanner
            variant="personal"
            signInRedirect={surface === "app" ? personalHome : "/ali/overview"}
          />
        ) : null}
        <PersonalPlanHeader title={title} />
        <div className="p-4 md:p-16 space-y-6 max-w-[1400px]">
          {showKpi ? <PersonalPlanKpiStrip month={undefined} /> : null}
          {showOverviewExtras ? <PersonalBillingAddons /> : null}
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
