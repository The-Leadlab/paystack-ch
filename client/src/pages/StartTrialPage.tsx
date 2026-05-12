import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { AuthLayout } from "./auth/AuthLayout";
import { isSelfServePlan, parsePaystackPlanId, SELECTED_PLAN_STORAGE_KEY, type PaystackPlanId } from "@shared/planCatalog";
import { startGuestCheckoutSession } from "@/cafe/lib/stripeCheckoutClient";

export default function StartTrialPage() {
  const { t } = useLanguage();
  const search = useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const planId = useMemo(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const p = parsePaystackPlanId(new URLSearchParams(qs).get("plan"));
    return p && isSelfServePlan(p) ? p : ("starter" as PaystackPlanId);
  }, [search]);

  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  const onCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, planId);
      }
      const url = await startGuestCheckoutSession(planId);
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout heading={t("startTrialTitle")}>
      <Card className="border-border shadow-sm max-w-lg mx-auto">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-brand-red">
            <CreditCard className="size-5" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">{t("startTrialSubtitle")}</span>
          </div>
          <p className="font-editorial text-sm text-muted-foreground leading-relaxed">{t("startTrialBody")}</p>
          <p className="font-display text-xs text-muted-foreground/90 bg-secondary/50 border border-border rounded-md px-3 py-2">
            {t("startTrialBillingNote")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCheckout} className="space-y-4">
            {err ? <p className="text-sm text-destructive font-medium">{err}</p> : null}
            <Button
              type="submit"
              size="lg"
              className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
              disabled={busy}
            >
              {busy ? t("authWorking") : t("startTrialCta")}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
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
