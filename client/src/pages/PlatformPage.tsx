import { lazy, Suspense, useEffect, type ReactNode } from "react";
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
import { SubscriptionProvider, useSubscription } from "@/cafe/context/SubscriptionContext";
import { WorkspaceProvider, useWorkspace } from "@/cafe/context/WorkspaceContext";
import { SubscriptionGate } from "@/cafe/components/SubscriptionGate";
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
import type { User } from "firebase/auth";

const RestaurantDashboard = lazy(() =>
  import("@/cafe/components/RestaurantDashboard").then((m) => ({ default: m.RestaurantDashboard }))
);

const PersonalAppPage = lazy(() => import("./PersonalAppPage"));

function isPersonalAppPath(path: string): boolean {
  return path === "/app/personal" || path.startsWith("/app/personal/");
}

function canAccessPersonalWorkspace(
  user: User | null | undefined,
  planId: PaystackPlanId | null | undefined
): boolean {
  if (isPersonalFinancesAccessUser(user)) return true;
  if (isPersonalPlan(planId)) return true;
  if (restaurantPlanIncludesPersonalBridge(planId)) return true;
  return false;
}

/** Blocks /app/personal unless personal plan, Unlimited bridge, or ops allowlist. */
function PersonalWorkspaceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { billing, loading } = useSubscription();
  const [location] = useLocation();
  if (!isPersonalAppPath(location)) return <>{children}</>;
  if (loading) return <DashboardLoadingShell />;
  if (!canAccessPersonalWorkspace(user, billing?.planId)) {
    return <Redirect to="/app" />;
  }
  return <>{children}</>;
}

/** Personal-only subscribers stay on /app/personal, not restaurant modules. */
function RestaurantWorkspaceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { billing, loading } = useSubscription();
  const [location] = useLocation();
  if (isPersonalAppPath(location)) return <>{children}</>;
  if (loading) return <DashboardLoadingShell />;
  if (isPersonalPlan(billing?.planId) && !isPersonalFinancesAccessUser(user)) {
    return <Redirect to="/app/personal/overview" />;
  }
  return <>{children}</>;
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
 * Firebase-authenticated dashboard — Business (`/app`) and Personal (`/app/personal/*`).
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
  const personal = isPersonalAppPath(location);

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
    const qs = encodeURIComponent(location.startsWith("/app") ? location : "/app");
    return <Redirect to={`/sign-in?redirect=${qs}`} />;
  }

  const bypassOps = isSubscriptionOrVerificationBypassUser(user);
  const isPasswordUser = user.providerData?.some((p) => p.providerId === "password");
  if (isPasswordUser && !user.emailVerified && !bypassOps) {
    return <EmailVerificationGate />;
  }

  if (location === "/app/personal") {
    return <Redirect to="/app/personal/overview" />;
  }

  return (
    <WorkspaceProvider>
      <SubscriptionProvider>
      <SessionProvider>
        <EmployeeProvider>
          <FinanceProvider>
            <POSProvider>
              <DocumentProvider>
                <TeamInviteAcceptEffect />
                <SubscriptionGate>
                  <PersonalWorkspaceGate>
                    <RestaurantWorkspaceGate>
                      <Suspense fallback={<DashboardLoadingShell />}>
                        {personal ? <PersonalAppPage /> : <RestaurantDashboard />}
                      </Suspense>
                    </RestaurantWorkspaceGate>
                  </PersonalWorkspaceGate>
                </SubscriptionGate>
              </DocumentProvider>
            </POSProvider>
          </FinanceProvider>
        </EmployeeProvider>
      </SessionProvider>
      </SubscriptionProvider>
    </WorkspaceProvider>
  );
}
