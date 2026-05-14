import React, { createContext, useContext, useMemo } from "react";
import { useLocation } from "wouter";
import { STRIPE_BILLING_PATH_LIVE, STRIPE_BILLING_PATH_TEST } from "../lib/stripeCheckoutClient";

export { STRIPE_BILLING_PATH_LIVE, STRIPE_BILLING_PATH_TEST } from "../lib/stripeCheckoutClient";

export function StripeBillingPathProvider({ children }: { children: React.ReactNode }) {
  const [loc] = useLocation();
  const path = useMemo(() => {
    return loc === "/test" || loc.startsWith("/test/") ? STRIPE_BILLING_PATH_TEST : STRIPE_BILLING_PATH_LIVE;
  }, [loc]);
  return <StripeBillingPathContext.Provider value={path}>{children}</StripeBillingPathContext.Provider>;
}

export function useStripeBillingApiPath(): string {
  return useContext(StripeBillingPathContext);
}
