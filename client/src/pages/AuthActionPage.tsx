import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { applyActionCode } from "firebase/auth";
import { CheckCircle2, Home, Loader2, LogIn, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { auth, firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { AuthLayout } from "./auth/AuthLayout";
import { isFirebaseHostingAuthDomain, productionSiteHomeUrl } from "@/cafe/lib/firebaseEmailAction";

type ActionState = "loading" | "success" | "error" | "redirect";

export default function AuthActionPage() {
  const { t } = useLanguage();
  const [state, setState] = useState<ActionState>("loading");
  const [detail, setDetail] = useState<string | null>(null);

  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const mode = params.get("mode") ?? "";
  const homeHref = productionSiteHomeUrl();

  useEffect(() => {
    if (isFirebaseHostingAuthDomain()) {
      const qs = params.toString();
      const target = `https://www.paystack.ch/auth/action${qs ? `?${qs}` : ""}`;
      window.location.replace(target);
      setState("redirect");
      return;
    }

    if (!firebaseReady || !auth) {
      setState("error");
      setDetail(t("authActionFirebaseMissing"));
      return;
    }

    const oobCode = params.get("oobCode")?.trim();
    if (!oobCode) {
      setState("error");
      setDetail(t("authActionInvalidLink"));
      return;
    }

    void (async () => {
      try {
        if (mode === "resetPassword") {
          window.location.replace(
            `/sign-in?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`
          );
          setState("redirect");
          return;
        }

        await applyActionCode(auth, oobCode);
        try {
          await auth.currentUser?.reload();
        } catch {
          /* optional */
        }
        setState("success");
      } catch (e) {
        setState("error");
        setDetail(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [mode, params, t]);

  if (!firebaseReady && state !== "redirect") {
    return <FirebaseMissing />;
  }

  if (state === "loading" || state === "redirect") {
    return (
      <AuthLayout heading={t("authActionWorkingTitle")}>
        <div className="flex flex-col items-center justify-center gap-4 py-16 max-w-lg mx-auto">
          <Loader2 className="size-10 animate-spin text-brand-red" aria-hidden />
          <p className="font-display text-sm text-muted-foreground text-center">{t("authActionWorkingBody")}</p>
        </div>
      </AuthLayout>
    );
  }

  if (state === "error") {
    return (
      <AuthLayout heading={t("authActionErrorTitle")}>
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
              <XCircle className="size-7 text-destructive" aria-hidden />
            </div>
            <p className="font-editorial text-sm text-muted-foreground leading-relaxed">
              {detail ?? t("authActionInvalidLink")}
            </p>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
            <Button asChild className="font-display bg-brand-red text-white hover:bg-brand-red/90 w-full gap-2">
              <a href={homeHref}>
                <Home className="size-4" />
                {t("authActionGoHome")}
              </a>
            </Button>
            <Button asChild variant="outline" className="font-display w-full gap-2">
              <Link href="/sign-in">
                <LogIn className="size-4" />
                {t("authSignInLink")}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  const successTitle =
    mode === "verifyEmail" || mode === "recoverEmail"
      ? t("authActionVerifiedTitle")
      : t("authActionSuccessTitle");
  const successBody =
    mode === "verifyEmail" || mode === "recoverEmail"
      ? t("authActionVerifiedBody")
      : t("authActionSuccessBody");

  return (
    <AuthLayout heading={successTitle}>
      <Card className="border-border shadow-sm max-w-lg mx-auto">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="font-editorial text-sm text-muted-foreground leading-relaxed">{successBody}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pb-2">
          <Button asChild className="font-display bg-brand-red text-white hover:bg-brand-red/90 w-full gap-2">
            <Link href="/sign-in?redirect=%2Fapp">
              <LogIn className="size-4" />
              {t("authActionContinueSignIn")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="font-display w-full gap-2">
            <a href={homeHref}>
              <Home className="size-4" />
              {t("authActionGoHome")}
            </a>
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
