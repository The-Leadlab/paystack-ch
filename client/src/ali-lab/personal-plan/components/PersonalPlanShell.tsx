import type { ReactNode } from "react";
import { Link } from "wouter";
import "../personalPlan.css";
import { PersonalPlanHeader } from "./PersonalPlanHeader";
import { PersonalPlanKpiStrip } from "./PersonalPlanKpiStrip";
import { PersonalPlanMobileNav, PersonalPlanSidebar } from "./PersonalPlanSidebar";
import { AliLabAuthBanner } from "../../components/AliLabAuthBanner";
import type { PersonalPlanSurface } from "../personalPlanNav";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";

export function PersonalPlanShell({
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
  const ledger = useLinkedLedger();

  return (
    <div className="personal-plan-shell">
      <PersonalPlanSidebar featureId={featureId} surface={surface} />
      <main className="md:ml-64 min-h-screen pb-24 md:pb-8">
        <AliLabAuthBanner variant="personal" />
        {surface === "app" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pp-outline-variant)] bg-[var(--pp-surface-container)] px-4 md:px-16 py-2 text-[11px] text-[var(--pp-on-surface-variant)]">
            <span>
              Linked to your business ledger — same sessions & transactions as{" "}
              <Link href="/app" className="text-[var(--pp-primary)] font-semibold underline-offset-2 hover:underline">
                /app
              </Link>
              {ledger.sessionLabel ? ` · ${ledger.sessionLabel}` : ""}
            </span>
            {!ledger.hasFirebaseData && !ledger.loading ? (
              <span>Add income or expenses in Business to populate Personal views.</span>
            ) : null}
          </div>
        ) : null}
        <PersonalPlanHeader title={title} />
        <div className="p-4 md:p-16 space-y-6 max-w-[1400px]">
          {showKpi ? <PersonalPlanKpiStrip /> : null}
          {children}
        </div>
      </main>
      <PersonalPlanMobileNav featureId={featureId} surface={surface} />
    </div>
  );
}
