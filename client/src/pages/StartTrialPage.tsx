import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { AuthLayout } from "./auth/AuthLayout";
import {
  isSelfServePlan,
  parsePaystackPlanId,
  parseBillingInterval,
  SELECTED_PLAN_STORAGE_KEY,
  type PaystackPlanId,
} from "@shared/planCatalog";
import { type LoginMode } from "@shared/loginMode";
import { storeSelectedLoginMode } from "@/cafe/lib/persistLoginMode";
import { startGuestCheckoutSession } from "@/cafe/lib/stripeCheckoutClient";

export default function StartTrialPage() {
  const { t } = useLanguage();
  const search = useSearch();
  const [err, setErr] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<LoginMode>("exclusive");
  const [confirmed, setConfirmed] = useState(false);
  const redirectStarted = useRef(false);

  const planId = useMemo(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(qs);
    const product = (params.get("product") || "").toLowerCase().trim();
    if (product === "personal") return "personal" as PaystackPlanId;
    const p = parsePaystackPlanId(params.get("plan"));
    return p && isSelfServePlan(p) ? p : ("starter" as PaystackPlanId);
  }, [search]);

  const isPersonal = planId === "personal";

  const cancelled = useMemo(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    return new URLSearchParams(qs).get("checkout") === "cancel";
  }, [search]);

  const billingInterval = useMemo(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    return parseBillingInterval(new URLSearchParams(qs).get("interval"));
  }, [search]);

  useEffect(() => {
    if (isPersonal) {
      storeSelectedLoginMode("exclusive");
      setConfirmed(true);
    }
  }, [isPersonal]);

  useEffect(() => {
    if (!firebaseReady || cancelled || !confirmed || redirectStarted.current) return;
    redirectStarted.current = true;
    storeSelectedLoginMode(loginMode);
    void (async () => {
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, planId);
        }
        const url = await startGuestCheckoutSession(planId, { billingInterval });
        window.location.href = url;
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        redirectStarted.current = false;
      }
    })();
  }, [firebaseReady, cancelled, confirmed, planId, billingInterval, loginMode]);

  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  if (cancelled) {
    const retryHref =
      planId === "personal" ? "/start-trial?product=personal" : `/start-trial?plan=${planId}`;
    return (
      <AuthLayout heading={t("startTrialCheckoutCancelled")}>
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardHeader>
            <p className="font-editorial text-sm text-muted-foreground leading-relaxed">
              {t("startTrialCheckoutCancelledHint")}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="default" className="font-display bg-brand-red text-white hover:bg-brand-red/90">
              <Link href={retryHref}>{t("startTrialRetry")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">{t("startTrialGoHome")}</Link>
            </Button>
          </CardContent>
          <CardFooter className="border-t border-border pt-4">
            <p className="font-display text-xs text-muted-foreground text-center w-full">
              {t("startTrialSignIn")}{" "}
              <Link href="/sign-in?redirect=%2Fapp" className="text-brand-red hover:underline font-medium">
                {t("authSignInLink")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  if (err) {
    return (
      <AuthLayout heading={t("startTrialTitle")}>
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-destructive font-medium">
              {t("authErrorPrefix")}
              {err}
            </p>
            <Button asChild className="font-display bg-brand-red text-white hover:bg-brand-red/90 w-full">
              <Link href="/">{t("startTrialGoHome")}</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  if (!isPersonal && !confirmed) {
    return (
      <AuthLayout heading={t("startTrialLoginModeTitle")}>
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardHeader className="space-y-2">
            <p className="font-editorial text-sm text-muted-foreground leading-relaxed">
              {t("startTrialLoginModeHint")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => setLoginMode("exclusive")}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                loginMode === "exclusive"
                  ? "border-brand-red bg-brand-red/5"
                  : "border-border hover:border-brand-red/40"
              }`}
            >
              <p className="font-display font-semibold text-sm">{t("loginModeExclusiveTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("loginModeExclusiveHint")}</p>
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("shared")}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                loginMode === "shared"
                  ? "border-brand-red bg-brand-red/5"
                  : "border-border hover:border-brand-red/40"
              }`}
            >
              <p className="font-display font-semibold text-sm">{t("loginModeSharedTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("loginModeSharedHint")}</p>
            </button>
            <Button
              type="button"
              className="font-display bg-brand-red text-white hover:bg-brand-red/90 w-full mt-2"
              onClick={() => setConfirmed(true)}
            >
              {t("startTrialContinueCheckout")}
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading={t("startTrialTitle")}>
      <div className="flex flex-col items-center justify-center gap-4 py-16 max-w-lg mx-auto">
        <Loader2 className="size-10 animate-spin text-brand-red" aria-hidden />
        <p className="font-display text-sm text-muted-foreground text-center">{t("startTrialRedirecting")}</p>
      </div>
    </AuthLayout>
  );
}
