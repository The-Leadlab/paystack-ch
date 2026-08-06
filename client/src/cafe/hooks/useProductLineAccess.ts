import { useAuth } from "@/cafe/context/AuthContext";
import { useSubscription } from "@/cafe/context/SubscriptionContext";
import { isPersonalFinancesAccessUser } from "@/cafe/lib/subscriptionBypass";
import { isPersonalPlan } from "@shared/planCatalog";

/** Personal-only subscribers must not open restaurant /app (ops allowlist may). */
export function useCanOpenBusinessDashboard(): boolean {
  const { user } = useAuth();
  const { billing, loading } = useSubscription();
  if (loading) return false;
  if (isPersonalFinancesAccessUser(user ?? null)) return true;
  if (isPersonalPlan(billing?.planId) && !isPersonalFinancesAccessUser(user ?? null)) return false;
  return true;
}
