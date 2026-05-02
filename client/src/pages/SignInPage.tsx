import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { LogIn } from "lucide-react";
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

function sanitizeRedirect(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/app";
  }
  return redirect;
}

export default function SignInPage() {
  const { t } = useLanguage();
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const nextPath = sanitizeRedirect(search);

  useEffect(() => {
    if (!loading && user) {
      setLocation(nextPath);
    }
  }, [loading, user, nextPath, setLocation]);

  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-display text-sm text-muted-foreground animate-pulse">{t("authWorking")}</div>
      </div>
    );
  }

  if (user) {
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
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
        return;
      }
      setLocation(nextPath);
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
      else setLocation(nextPath);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout heading={t("authSignInTitle")}>
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
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
              <Label htmlFor="signin-email" className="font-display text-xs">
                {t("authEmailLabel")}
              </Label>
              <Input
                id="signin-email"
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
              <Label htmlFor="signin-password" className="font-display text-xs">
                {t("authPasswordLabel")}
              </Label>
              <Input
                id="signin-password"
                type="password"
                autoComplete="current-password"
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
              <LogIn className="size-4" />
              {submitting ? t("authWorking") : t("authSubmitSignIn")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="font-display text-sm text-muted-foreground text-center w-full">
            {t("authNeedAccount")}{" "}
            <Link
              href={`/sign-up?redirect=${encodeURIComponent(nextPath)}`}
              className="text-brand-red hover:underline font-medium"
            >
              {t("authSignUpLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
