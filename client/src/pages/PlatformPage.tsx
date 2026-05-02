import { Redirect } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { SessionProvider } from "@/cafe/context/SessionContext";
import { EmployeeProvider } from "@/cafe/context/EmployeeContext";
import { FinanceProvider } from "@/cafe/context/FinanceContext";
import { DocumentProvider } from "@/cafe/context/DocumentContext";
import { POSProvider } from "@/cafe/context/POSContext";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { EmailVerificationGate } from "@/cafe/components/EmailVerificationGate";
import { RestaurantDashboard } from "@/cafe/components/RestaurantDashboard";
import { firebaseReady } from "@/cafe/lib/firebase";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-cdlp-dark flex items-center justify-center">
        <div className="animate-pulse font-black text-cdlp-gold uppercase tracking-widest text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    const qs = encodeURIComponent("/app");
    return <Redirect to={`/sign-in?redirect=${qs}`} />;
  }

  const isAdmin = user.email === "admin@test.com";
  const isPasswordUser = user.providerData?.some((p) => p.providerId === "password");
  if (isPasswordUser && !user.emailVerified && !isAdmin) {
    return <EmailVerificationGate />;
  }

  return (
    <SessionProvider>
      <EmployeeProvider>
        <FinanceProvider>
          <POSProvider>
            <DocumentProvider>
              <RestaurantDashboard />
            </DocumentProvider>
          </POSProvider>
        </FinanceProvider>
      </EmployeeProvider>
    </SessionProvider>
  );
}
