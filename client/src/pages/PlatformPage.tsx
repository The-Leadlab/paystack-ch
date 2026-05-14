import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { SessionProvider } from "@/cafe/context/SessionContext";
import { EmployeeProvider } from "@/cafe/context/EmployeeContext";
import { FinanceProvider } from "@/cafe/context/FinanceContext";
import { DocumentProvider } from "@/cafe/context/DocumentContext";
import { POSProvider } from "@/cafe/context/POSContext";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { EmailVerificationGate } from "@/cafe/components/EmailVerificationGate";
import { RestaurantDashboard } from "@/cafe/components/RestaurantDashboard";
import { SubscriptionProvider } from "@/cafe/context/SubscriptionContext";
import { SubscriptionGate } from "@/cafe/components/SubscriptionGate";
import { firebaseReady } from "@/cafe/lib/firebase";
import { isSubscriptionOrVerificationBypassUser } from "@/cafe/lib/subscriptionBypass";

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
  const { t } = useLanguage();
  const [loc] = useLocation();
  const appReturnPath = loc.startsWith("/test/") ? "/test/app" : "/app";

  if (loading) {
    return (
      <div className="min-h-screen bg-cdlp-dark flex items-center justify-center">
        <div className="animate-pulse font-black text-cdlp-gold uppercase tracking-widest text-sm">{t("appLoading")}</div>
      </div>
    );
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
                  <RestaurantDashboard />
                </SubscriptionGate>
              </DocumentProvider>
            </POSProvider>
          </FinanceProvider>
        </EmployeeProvider>
      </SessionProvider>
    </SubscriptionProvider>
  );
}
