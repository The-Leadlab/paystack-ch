import { lazy, Suspense, useEffect } from "react";
import { Redirect, useSearch } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { SessionProvider } from "@/cafe/context/SessionContext";
import { EmployeeProvider } from "@/cafe/context/EmployeeContext";
import { FinanceProvider } from "@/cafe/context/FinanceContext";
import { DocumentProvider } from "@/cafe/context/DocumentContext";
import { POSProvider } from "@/cafe/context/POSContext";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { EmailVerificationGate } from "@/cafe/components/EmailVerificationGate";
import { DashboardLoadingShell } from "@/cafe/components/DashboardLoadingShell";
import { SubscriptionProvider } from "@/cafe/context/SubscriptionContext";
import { SubscriptionGate } from "@/cafe/components/SubscriptionGate";
import { firebaseReady } from "@/cafe/lib/firebase";
import { isSubscriptionOrVerificationBypassUser } from "@/cafe/lib/subscriptionBypass";
import { isSelfServePlan, parsePaystackPlanId, SELECTED_PLAN_STORAGE_KEY } from "@shared/planCatalog";

const RestaurantDashboard = lazy(() =>
  import("@/cafe/components/RestaurantDashboard").then((m) => ({ default: m.RestaurantDashboard }))
);

/**
 * Firebase-authenticated dashboard (formerly mounted only from the orphan CafeApp entry).
 */
export default function PlatformPage() {
  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  return <PlatformContent />;
}

function PlatformContent() {
  const { user, loading } = useAuth();
  const search = useSearch();
  const appReturnPath = "/app";

  useEffect(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const plan = parsePaystackPlanId(new URLSearchParams(qs).get("plan"));
    if (plan && isSelfServePlan(plan) && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, plan);
    }
  }, [search]);

  if (loading) {
    return <DashboardLoadingShell mode="auth" />;
  }

  if (!user) {
    const qs = encodeURIComponent(appReturnPath);
    return <Redirect to={`/sign-in?redirect=${qs}`} />;
  }

  const bypassOps = isSubscriptionOrVerificationBypassUser(user);
  const isPasswordUser = user.providerData?.some((p) => p.providerId === "password");
  if (isPasswordUser && !user.emailVerified && !bypassOps) {
    return <EmailVerificationGate />;
  }

  return (
    <SubscriptionProvider>
      <SessionProvider>
        <EmployeeProvider>
          <FinanceProvider>
            <POSProvider>
              <DocumentProvider>
                <SubscriptionGate>
                  <Suspense fallback={<DashboardLoadingShell />}>
                    <RestaurantDashboard />
                  </Suspense>
                </SubscriptionGate>
              </DocumentProvider>
            </POSProvider>
          </FinanceProvider>
        </EmployeeProvider>
      </SessionProvider>
    </SubscriptionProvider>
  );
}
