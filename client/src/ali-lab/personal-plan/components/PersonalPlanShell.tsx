import type { ReactNode } from "react";
import { Link } from "wouter";
import "../personalPlan.css";
import { PersonalPlanProvider, usePersonalPlan } from "../context/PersonalPlanContext";
import { PersonalPlanHeader } from "./PersonalPlanHeader";
import { PersonalPlanKpiStrip } from "./PersonalPlanKpiStrip";
import { PersonalPlanMobileNav, PersonalPlanSidebar } from "./PersonalPlanSidebar";
import { PersonalSessionBar } from "./PersonalSessionBar";
import { PersonalTransactionModal } from "./PersonalTransactionModal";
import { AliLabAuthBanner } from "../../components/AliLabAuthBanner";
import type { PersonalPlanSurface } from "../personalPlanNav";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";

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
  const { month } = usePersonalPlan();
  const ledger = useLinkedLedger(month);

  return (
    <div className="personal-plan-shell">
      <PersonalPlanSidebar featureId={featureId} surface={surface} />
      <main className="md:ml-64 min-h-screen pb-24 md:pb-8">
        {surface !== "app" ? (
          <AliLabAuthBanner
            variant="personal"
            signInRedirect={surface === "app" ? "/app/personal/overview" : "/ali/overview"}
          />
        ) : null}
        {surface === "app" ? null : (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pp-outline-variant)] bg-[var(--pp-surface-container)] px-4 md:px-16 py-2 text-[11px] text-[var(--pp-on-surface-variant)]">
            <span>
              Linked to your business ledger — same Firebase data as{" "}
              <Link href="/app" className="text-[var(--pp-primary)] font-semibold underline-offset-2 hover:underline">
                Business
              </Link>
              {ledger.sessionLabel ? ` · ${ledger.sessionLabel}` : ""}
            </span>
            {!ledger.hasFirebaseData && !ledger.loading ? (
              <span>Use Add transaction below or enter data in Business.</span>
            ) : null}
          </div>
        )}
        {surface !== "app" ? <PersonalSessionBar month={month} /> : null}
        <PersonalPlanHeader title={title} />
        <div className="p-4 md:p-16 space-y-6 max-w-[1400px]">
          {showKpi ? <PersonalPlanKpiStrip month={month} /> : null}
          {children}
        </div>
      </main>
      <PersonalPlanMobileNav featureId={featureId} surface={surface} />
      <PersonalTransactionModal />
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
