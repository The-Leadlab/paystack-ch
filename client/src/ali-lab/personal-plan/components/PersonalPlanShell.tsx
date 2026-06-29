import type { ReactNode } from "react";
import "../personalPlan.css";
import { PersonalPlanHeader } from "./PersonalPlanHeader";
import { PersonalPlanKpiStrip } from "./PersonalPlanKpiStrip";
import { PersonalPlanMobileNav, PersonalPlanSidebar } from "./PersonalPlanSidebar";
import { AliLabAuthBanner } from "../../components/AliLabAuthBanner";

export function PersonalPlanShell({
  featureId,
  title,
  showKpi = true,
  children,
}: {
  featureId: string | undefined;
  title?: string;
  showKpi?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="personal-plan-shell">
      <PersonalPlanSidebar featureId={featureId} />
      <main className="md:ml-64 min-h-screen pb-24 md:pb-8">
        <AliLabAuthBanner variant="personal" />
        <PersonalPlanHeader title={title} />
        <div className="p-4 md:p-16 space-y-6 max-w-[1400px]">
          {showKpi ? <PersonalPlanKpiStrip /> : null}
          {children}
        </div>
      </main>
      <PersonalPlanMobileNav featureId={featureId} />
    </div>
  );
}
