import { useState } from "react";
import { Link } from "wouter";
import { FlaskConical, LayoutDashboard, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import {
  STRIPE_BILLING_PATH_TEST,
  startGuestCheckoutSession,
} from "@/cafe/lib/stripeCheckoutClient";
import { isSelfServePlan, SELECTED_PLAN_STORAGE_KEY, type PaystackPlanId } from "@shared/planCatalog";

/**
 * Internal QA lane: Stripe test keys only (`/api/stripe-test/*`). Production checkout stays on `/app` and `/api/stripe/*`.
 */
export default function TestPlatformPage() {
  const [busyPlan, setBusyPlan] = useState<PaystackPlanId | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  const runGuestTestCheckout = async (planId: PaystackPlanId) => {
    if (!isSelfServePlan(planId)) return;
    setErr(null);
    setBusyPlan(planId);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, planId);
      }
      const url = await startGuestCheckoutSession(planId, STRIPE_BILLING_PATH_TEST);
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPlan(null);
    }
  };

  const plans: PaystackPlanId[] = ["starter", "business", "unlimited"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              <FlaskConical className="size-3.5" />
              Stripe test mode
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Platform test lane</h1>
            <p className="font-editorial text-muted-foreground max-w-xl leading-relaxed">
              This route uses your{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">STRIPE_TEST_SECRET_KEY</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">STRIPE_TEST_PRICE_*</code> prices only. Normal
              customers keep using live checkout on <Link href="/app">/app</Link>.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to site</Link>
          </Button>
        </div>

        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5 text-amber-600" />
              Test cards
            </CardTitle>
            <CardDescription>
              Use Stripe test numbers (for example <code className="text-xs">4242 4242 4242 4242</code> with any future
              expiry and any CVC). See the official list for declines and 3D Secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="https://docs.stripe.com/testing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-red hover:underline"
            >
              Stripe testing documentation
              <ExternalLink className="size-3.5" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutDashboard className="size-5" />
              Open the app (test billing)
            </CardTitle>
            <CardDescription>
              Signed-in checkout and customer portal from here call <code className="text-xs">/api/stripe-test/*</code>{" "}
              while you stay under <code className="text-xs">/test/app</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="bg-brand-red text-white hover:bg-brand-red/90">
              <Link href="/test/app">Go to /test/app</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sign-in?redirect=%2Ftest%2Fapp">Sign in (redirect to test app)</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guest trial checkout (per plan)</CardTitle>
            <CardDescription>
              Starts Checkout in test mode, then returns to sign-up with <code className="text-xs">stripe_test=1</code>{" "}
              so the subscription links against the test API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="secondary"
                  disabled={busyPlan !== null}
                  onClick={() => void runGuestTestCheckout(p)}
                >
                  {busyPlan === p ? "Starting…" : `Guest checkout — ${p}`}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Configure <code className="rounded bg-muted px-1">STRIPE_TEST_WEBHOOK_SECRET</code> pointing at{" "}
          <code className="rounded bg-muted px-1">/api/stripe-test/webhook</code> so Firestore subscription state
          updates after payment.
        </p>
      </div>
    </div>
  );
}
