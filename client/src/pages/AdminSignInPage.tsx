import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { CreditCard, Loader2, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useAuth } from "@/cafe/context/AuthContext";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { isSubscriptionBypassEmail } from "@/cafe/lib/subscriptionBypass";
import { GoogleGIcon } from "@/components/icons/GoogleGIcon";
import { AuthLayout } from "./auth/AuthLayout";
import { logoutAdmin } from "@/lib/adminGateClient";
import { clientStripeUseTest, startGuestCheckoutSession } from "@/cafe/lib/stripeCheckoutClient";
import { SELECTED_PLAN_STORAGE_KEY, type PaystackPlanId } from "@shared/planCatalog";
import { SeoNoIndex } from "@/components/SeoNoIndex";
import { PlanMarketingPanel } from "@/cafe/components/PlanMarketingPanel";

export default function AdminSignInPage() {
  const { t } = useLanguage();
  const { user, loading, signIn, signInWithGoogle, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const [testPlan, setTestPlan] = useState<PaystackPlanId>("starter");
  const [checkoutBusy, setCheckoutBusy] = useState<"live" | "test" | null>(null);
  const [gateErr, setGateErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const sandboxOnly = clientStripeUseTest();

  useEffect(() => {
    if (loading || !user) return;
    if (isSubscriptionBypassEmail(user.email)) {
      setLocation("/app");
      return;
    }
    setError(t("authAdminUnauthorized"));
    void signOut();
  }, [loading, user, setLocation, signOut, t]);

  const lockGate = async () => {
    setLockBusy(true);
    try {
      await logoutAdmin();
    } catch {
      /* still navigate away */
    } finally {
      setLockBusy(false);
      window.location.href = "/operator";
    }
  };

  const openGuestCheckout = async (useTest: boolean) => {
    setGateErr(null);
    if (testPlan === "enterprise") {
      setGateErr(t("authAdminEnterpriseNoCheckout"));
      return;
    }
    const effectiveTest = sandboxOnly || useTest;
    setCheckoutBusy(effectiveTest ? "test" : "live");
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, testPlan);
      }
      const url = await startGuestCheckoutSession(testPlan, {
        useTestStripe: effectiveTest,
        sandboxSource: effectiveTest ? "query" : undefined,
      });
      window.location.href = url;
    } catch (e) {
      setGateErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckoutBusy(null);
    }
  };

  const planLabel = (id: PaystackPlanId) => {
    if (id === "starter") return t("planStarterName");
    if (id === "business") return t("planBusinessName");
    if (id === "unlimited") return t("planUnlimitedName");
    if (id === "enterprise") return t("planEnterpriseName");
    return id;
  };

  return (
    <>
      <SeoNoIndex />
      <AuthLayout
        heading={t("authAdminTitle")}
        description={t("authAdminDescription")}
        showFooterSecure={false}
      >
        <div className="max-w-lg mx-auto space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-brand-red">
                {t("authAdminPlanTestTitle")}
              </span>
              <Button type="button" variant="outline" size="sm" className="font-display gap-1" onClick={() => void lockGate()} disabled={lockBusy}>
                {lockBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                {t("authAdminGateLock")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["starter", "business", "unlimited", "enterprise"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTestPlan(id)}
                    className={`rounded border px-2 py-2 text-[10px] font-black uppercase tracking-tight transition-colors ${
                      testPlan === id
                        ? "border-brand-red bg-brand-red/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-brand-red/40"
                    }`}
                  >
                    {planLabel(id)}
                  </button>
                ))}
              </div>
              <PlanMarketingPanel planId={testPlan} variant="card" showMostPopularBadge />
              {sandboxOnly ? (
                <p className="text-xs text-muted-foreground leading-relaxed rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  {t("stripeSandboxModeActive")}
                </p>
              ) : null}
              <div className="flex flex-col sm:flex-row gap-2">
                {!sandboxOnly ? (
                  <Button
                    type="button"
                    className="flex-1 font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                    disabled={checkoutBusy !== null || testPlan === "enterprise"}
                    onClick={() => void openGuestCheckout(false)}
                  >
                    {checkoutBusy === "live" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {t("authAdminPlanLive")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={sandboxOnly ? "default" : "secondary"}
                  className={`flex-1 font-display gap-2 ${sandboxOnly ? "bg-brand-red text-white hover:bg-brand-red/90" : ""}`}
                  disabled={checkoutBusy !== null || testPlan === "enterprise"}
                  onClick={() => void openGuestCheckout(true)}
                >
                  {checkoutBusy === "test" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                  {t("authAdminPlanTest")}
                </Button>
              </div>
              {testPlan === "enterprise" ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{t("authAdminEnterpriseNoCheckout")}</p>
              ) : null}
              {gateErr ? (
                <p className="text-sm text-destructive font-medium">
                  {t("authErrorPrefix")}
                  {gateErr}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <p className="font-display text-xs font-bold uppercase tracking-wider text-center text-muted-foreground">
            {t("authAdminBypassSectionTitle")}
          </p>

          {!firebaseReady ? (
            <FirebaseMissing />
          ) : loading || user ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-brand-red" aria-hidden />
            </div>
          ) : (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-display gap-2 border-border bg-background hover:bg-secondary/80"
                  onClick={async () => {
                    setError(null);
                    setGoogleLoading(true);
                    try {
                      const { error: err } = await signInWithGoogle({ skipRegistrationGate: true });
                      if (err) setError(err.message);
                    } finally {
                      setGoogleLoading(false);
                    }
                  }}
                  disabled={googleLoading || submitting}
                >
                  <GoogleGIcon className="size-[18px] shrink-0" />
                  {googleLoading ? t("authWorking") : t("authAdminGoogle")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground font-display">{t("authDividerEmail")}</span>
                  </div>
                </div>
                <form
                  onSubmit={async (e: FormEvent) => {
                    e.preventDefault();
                    setError(null);
                    setSubmitting(true);
                    try {
                      const { error: err } = await signIn(email, password);
                      if (err) {
                        setError(err.message);
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="space-y-4 pt-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="font-display text-xs">
                      {t("authEmailLabel")}
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="font-editorial"
                      placeholder={t("authPlaceholderAdminEmail")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="font-display text-xs">
                      {t("authPasswordLabel")}
                    </Label>
                    <Input
                      id="admin-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="font-editorial"
                    />
                  </div>
                  {error ? (
                    <p className="text-sm text-destructive font-medium">
                      {t("authErrorPrefix")}
                      {error}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                    disabled={submitting || googleLoading}
                  >
                    <LogIn className="size-4" />
                    {submitting ? t("authWorking") : t("authAdminSubmit")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </AuthLayout>
    </>
  );
}
