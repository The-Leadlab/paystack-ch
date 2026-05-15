import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { CreditCard, Loader2, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useAuth } from "@/cafe/context/AuthContext";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { isSubscriptionBypassEmail } from "@/cafe/lib/subscriptionBypass";
import { GoogleGIcon } from "@/components/icons/GoogleGIcon";
import { AuthLayout } from "./auth/AuthLayout";
import { verifyAdminPassword } from "@/lib/adminGateClient";
import { startGuestCheckoutSession } from "@/cafe/lib/stripeCheckoutClient";
import { SELECTED_PLAN_STORAGE_KEY, type PaystackPlanId } from "@shared/planCatalog";

const ADMIN_GATE_SESSION_KEY = "paystack_admin_gate_v1";

export default function AdminSignInPage() {
  const { t } = useLanguage();
  const { user, loading, signIn, signInWithGoogle, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState<string | null>(null);

  const [testPlan, setTestPlan] = useState<PaystackPlanId>("starter");
  const [checkoutBusy, setCheckoutBusy] = useState<"live" | "test" | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    try {
      setGateUnlocked(sessionStorage.getItem(ADMIN_GATE_SESSION_KEY) === "1");
    } catch {
      setGateUnlocked(false);
    }
  }, []);

  useEffect(() => {
    if (!gateUnlocked || loading || !user) return;
    if (isSubscriptionBypassEmail(user.email)) {
      setLocation("/app");
      return;
    }
    setError(t("authAdminUnauthorized"));
    void signOut();
  }, [gateUnlocked, loading, user, setLocation, signOut, t]);

  const lockGate = () => {
    try {
      sessionStorage.removeItem(ADMIN_GATE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    setGateUnlocked(false);
    setGatePassword("");
  };

  const onGateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGateErr(null);
    setGateBusy(true);
    try {
      await verifyAdminPassword(gatePassword);
      try {
        sessionStorage.setItem(ADMIN_GATE_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setGateUnlocked(true);
      setGatePassword("");
    } catch (err) {
      setGateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setGateBusy(false);
    }
  };

  const openGuestCheckout = async (useTest: boolean) => {
    setGateErr(null);
    setCheckoutBusy(useTest ? "test" : "live");
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, testPlan);
      }
      const url = await startGuestCheckoutSession(testPlan, { useTestStripe: useTest });
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
    return id;
  };

  if (!gateUnlocked) {
    return (
      <AuthLayout heading={t("authAdminGateTitle")} description={t("authAdminGateDescription")}>
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardContent className="pt-6">
            <form onSubmit={onGateSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gate-password" className="font-display text-xs">
                  {t("authAdminGatePasswordLabel")}
                </Label>
                <Input
                  id="gate-password"
                  type="password"
                  autoComplete="off"
                  value={gatePassword}
                  onChange={(e) => setGatePassword(e.target.value)}
                  required
                  className="font-editorial"
                />
              </div>
              {gateErr ? (
                <p className="text-sm text-destructive font-medium">
                  {t("authErrorPrefix")}
                  {gateErr}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                disabled={gateBusy}
              >
                {gateBusy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {gateBusy ? t("authWorking") : t("authAdminGateSubmit")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-border flex-col gap-2">
            <Button asChild variant="ghost" size="sm" className="font-display text-muted-foreground">
              <Link href="/">{t("authBackHome")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading={t("authAdminTitle")} description={t("authAdminDescription")}>
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-brand-red">
              {t("authAdminPlanTestTitle")}
            </span>
            <Button type="button" variant="outline" size="sm" className="font-display gap-1" onClick={lockGate}>
              <Lock className="size-3.5" />
              {t("authAdminGateLock")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["starter", "business", "unlimited"] as const).map((id) => (
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                className="flex-1 font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                disabled={checkoutBusy !== null}
                onClick={() => void openGuestCheckout(false)}
              >
                {checkoutBusy === "live" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                {t("authAdminPlanLive")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 font-display gap-2"
                disabled={checkoutBusy !== null}
                onClick={() => void openGuestCheckout(true)}
              >
                {checkoutBusy === "test" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                {t("authAdminPlanTest")}
              </Button>
            </div>
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
                    const { error: err } = await signInWithGoogle();
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
  );
}
