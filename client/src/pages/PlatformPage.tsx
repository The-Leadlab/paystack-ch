import { lazy, Suspense, useEffect } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { SessionProvider } from "@/cafe/context/SessionContext";
import { EmployeeProvider } from "@/cafe/context/EmployeeContext";
import { FinanceProvider } from "@/cafe/context/FinanceContext";
import { DocumentProvider } from "@/cafe/context/DocumentContext";
import { POSProvider } from "@/cafe/context/POSContext";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { EmailVerificationGate } from "@/cafe/components/EmailVerificationGate";
import { DashboardLoadingShell } from "@/cafe/components/DashboardLoadingShell";
import { UserActivityTracker } from "@/cafe/components/UserActivityTracker";
import { SubscriptionProvider, useSubscription } from "@/cafe/context/SubscriptionContext";
import { WorkspaceProvider, useWorkspace } from "@/cafe/context/WorkspaceContext";
import { SubscriptionGate } from "@/cafe/components/SubscriptionGate";
import { SessionAccessShell } from "@/cafe/components/SessionAccessShell";
import { firebaseReady } from "@/cafe/lib/firebase";
import {
  isPersonalFinancesAccessUser,
  isSubscriptionOrVerificationBypassUser,
} from "@/cafe/lib/subscriptionBypass";
import {
  isPersonalPlan,
  isSelfServePlan,
  parsePaystackPlanId,
  restaurantPlanIncludesPersonalBridge,
  SELECTED_PLAN_STORAGE_KEY,
  type PaystackPlanId,
} from "@shared/planCatalog";
import {
  canonicalizePersonalPath,
  isPersonalAppPath,
  personalAppHomePath,
} from "@/ali-lab/personal-plan/personalPlanNav";
import type { User } from "firebase/auth";

export { useCanOpenBusinessDashboard } from "@/cafe/hooks/useProductLineAccess";

const RestaurantDashboard = lazy(() =>
  import("@/cafe/components/RestaurantDashboard").then((m) => ({ default: m.RestaurantDashboard }))
);

const PersonalAppPage = lazy(() => import("./PersonalAppPage"));

function canAccessPersonalWorkspace(
  user: User | null | undefined,
  planId: PaystackPlanId | null | undefined
): boolean {
  if (isPersonalFinancesAccessUser(user ?? null)) return true;
  if (isPersonalPlan(planId)) return true;
  if (restaurantPlanIncludesPersonalBridge(planId)) return true;
  return false;
}

/** Personal-only: no restaurant /app. Ops allowlist may use both. */
function isPersonalOnlySubscriber(
  user: User | null | undefined,
  planId: PaystackPlanId | null | undefined
): boolean {
  return isPersonalPlan(planId) && !isPersonalFinancesAccessUser(user ?? null);
}

/** Accepts ?team_invite=TOKEN once after sign-in. */
function TeamInviteAcceptEffect() {
  const { user } = useAuth();
  const { acceptInviteToken } = useWorkspace();
  const search = useSearch();

  useEffect(() => {
    if (!user) return;
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const token = new URLSearchParams(qs).get("team_invite");
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        await acceptInviteToken(token);
        if (!cancelled) {
          const url = new URL(window.location.href);
          url.searchParams.delete("team_invite");
          window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
        }
      } catch (e) {
        if (!cancelled) {
          alert(e instanceof Error ? e.message : "Could not accept team invite");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, search, acceptInviteToken]);

  return null;
}

/**
 * Business (`/app`) and Personal (`/personal`) are separate product shells.
 * Legacy `/app/personal/*` redirects to `/personal/*`.
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
  const [location] = useLocation();

  useEffect(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(qs);
    const product = (params.get("product") || "").toLowerCase();
    if (product === "personal" && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, "personal");
    }
    const plan = parsePaystackPlanId(params.get("plan"));
    if (plan && isSelfServePlan(plan) && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, plan);
    }
  }, [search]);

  if (loading) {
    return <DashboardLoadingShell mode="auth" />;
  }

  if (!user) {
    const qs = encodeURIComponent(
      location.startsWith("/app") || location.startsWith("/personal") ? location : "/app"
    );
    return <Redirect to={`/sign-in?redirect=${qs}`} />;
  }

  const bypassOps = isSubscriptionOrVerificationBypassUser(user);
  const isPasswordUser = user.providerData?.some((p) => p.providerId === "password");
  if (isPasswordUser && !user.emailVerified && !bypassOps) {
    return <EmailVerificationGate />;
  }

  const legacyPersonal = canonicalizePersonalPath(location);
  if (legacyPersonal && legacyPersonal !== location) {
    return <Redirect to={legacyPersonal} />;
  }

  return (
    <WorkspaceProvider>
      <UserActivityTracker />
      <SubscriptionProvider>
        <TeamInviteAcceptEffect />
        <SubscriptionGate>
          <ProductLineShell />
        </SubscriptionGate>
      </SubscriptionProvider>
    </WorkspaceProvider>
  );
}

/**
 * After billing is known: route Personal vs Business into different provider trees
 * so Personal does not mount restaurant POS / employees / etc.
 */
function ProductLineShell() {
  const { user } = useAuth();
  const { billing, loading } = useSubscription();
  const [location] = useLocation();
  const personalPath = isPersonalAppPath(location);

  if (loading) {
    return <DashboardLoadingShell />;
  }

  const personalOnly = isPersonalOnlySubscriber(user, billing?.planId);

  if (personalOnly && !personalPath) {
    return <Redirect to={personalAppHomePath()} />;
  }

  if (personalPath) {
    if (!canAccessPersonalWorkspace(user, billing?.planId)) {
      return <Redirect to="/app" />;
    }
    return (
      <SessionProvider>
        <FinanceProvider>
          <DocumentProvider>
            <Suspense fallback={<DashboardLoadingShell />}>
              <PersonalAppPage />
            </Suspense>
          </DocumentProvider>
        </FinanceProvider>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
      <SessionAccessShell>
        <EmployeeProvider>
          <FinanceProvider>
            <POSProvider>
              <DocumentProvider>
                <Suspense fallback={<DashboardLoadingShell />}>
                  <RestaurantDashboard />
                </Suspense>
              </DocumentProvider>
            </POSProvider>
          </FinanceProvider>
        </EmployeeProvider>
      </SessionAccessShell>
    </SessionProvider>
  );
}

