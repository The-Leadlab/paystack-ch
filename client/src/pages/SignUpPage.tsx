import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useAuth } from "@/cafe/context/AuthContext";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { AuthLayout } from "./auth/AuthLayout";
import { GoogleGIcon } from "@/components/icons/GoogleGIcon";
import { isSelfServePlan, parsePaystackPlanId, SELECTED_PLAN_STORAGE_KEY } from "@shared/planCatalog";
import {
  checkoutSuccessSessionId,
  linkCheckoutSessionAfterAuth,
  preserveCheckoutInAuthHref,
} from "@/cafe/lib/stripeCheckoutClient";

function sanitizeRedirect(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/app";
  }
  return redirect;
}

export default function SignUpPage() {
  const { t } = useLanguage();
  const { user, loading, signUp, signInWithGoogle, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkoutLinkError, setCheckoutLinkError] = useState<string | null>(null);
  const linkStartedRef = useRef(false);

  const nextPath = sanitizeRedirect(search);
  const checkoutSid = useMemo(() => checkoutSuccessSessionId(search), [search]);

  useEffect(() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(qs);
    const plan = parsePaystackPlanId(params.get("plan"));
    if (plan && isSelfServePlan(plan) && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, plan);
    }
  }, [search]);

  useEffect(() => {
    if (loading || !user) return;
    if (!checkoutSid) {
      setLocation(nextPath);
      return;
    }
    if (checkoutLinkError) return;
    if (linkStartedRef.current) return;
    linkStartedRef.current = true;
    let alive = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        await linkCheckoutSessionAfterAuth(token, checkoutSid);
        if (alive) setLocation(nextPath);
      } catch (e) {
        linkStartedRef.current = false;
        if (alive) setCheckoutLinkError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, user, checkoutSid, nextPath, setLocation, checkoutLinkError]);

  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-display text-sm text-muted-foreground animate-pulse">{t("authWorking")}</div>
      </div>
    );
  }

  if (user && checkoutSid) {
    if (checkoutLinkError) {
      return (
        <AuthLayout heading={t("checkoutLinkErrorTitle")}>
          <Card className="border-border shadow-sm max-w-md mx-auto">
            <CardContent className="pt-6 space-y-4">
              <p className="font-editorial text-sm text-destructive">{checkoutLinkError}</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-display"
                  onClick={() => {
                    setCheckoutLinkError(null);
                    linkStartedRef.current = false;
                  }}
                >
                  {t("checkoutTryAgain")}
                </Button>
                <Button
                  type="button"
                  className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90"
                  onClick={() => setLocation(nextPath)}
                >
                  {t("checkoutContinueWithoutLink")}
                </Button>
                <Button type="button" variant="ghost" className="w-full font-display" onClick={() => signOut()}>
                  {t("logout")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </AuthLayout>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-display text-sm text-muted-foreground animate-pulse">{t("authWorking")}</div>
      </div>
    );
  }

  if (user && !checkoutSid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-display text-sm text-muted-foreground animate-pulse">{t("authWorking")}</div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await signUp(email, password, displayName);
      if (err) {
        setError(err.message);
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const signInHref = preserveCheckoutInAuthHref(`/sign-in?redirect=${encodeURIComponent(nextPath)}`, search);

  return (
    <AuthLayout heading={t("authSignUpTitle")}>
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2 space-y-3">
          {checkoutSid ? (
            <p className="font-display text-xs text-muted-foreground bg-secondary/50 border border-border rounded-md px-3 py-2 leading-relaxed">
              {t("checkoutSameEmailNote")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full font-display gap-2 border-border bg-background hover:bg-secondary/80"
            onClick={handleGoogle}
            disabled={googleLoading || submitting}
          >
            <GoogleGIcon className="size-[18px] shrink-0" />
            {googleLoading ? t("authWorking") : t("authContinueGoogle")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-display">email</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="font-display text-xs">
                {t("authDisplayName")}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="font-editorial pl-10"
                  placeholder="Marie Mueller"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="font-display text-xs">
                {t("authEmailLabel")}
              </Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-editorial"
                placeholder="vous@entreprise.ch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="font-display text-xs">
                {t("authPasswordLabel")}
              </Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="font-editorial"
              />
            </div>
            {error ? <p className="text-sm text-destructive font-medium">{error}</p> : null}
            <Button
              type="submit"
              className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
              disabled={submitting || googleLoading}
            >
              <UserPlus className="size-4" />
              {submitting ? t("authWorking") : t("authSubmitSignUp")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="font-display text-sm text-muted-foreground text-center w-full">
            {t("authHaveAccount")}{" "}
            <Link href={signInHref} className="text-brand-red hover:underline font-medium">
              {t("authSignInLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
