import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useAuth } from "@/cafe/context/AuthContext";
import { firebaseReady } from "@/cafe/lib/firebase";
import { FirebaseMissing } from "@/cafe/components/FirebaseMissing";
import { AuthLayout } from "./auth/AuthLayout";

function sanitizeRedirect(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/app";
  }
  return redirect;
}

export default function SignUpPage() {
  const { t } = useLanguage();
  const { user, loading, signUp } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = sanitizeRedirect(search);

  useEffect(() => {
    if (!loading && user) {
      setLocation(nextPath);
    }
  }, [loading, user, nextPath, setLocation]);

  if (!firebaseReady) {
    return <FirebaseMissing />;
  }

  if (loading || user) {
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
      setLocation(nextPath);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout heading={t("authSignUpTitle")}>
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={submitting}
            >
              <UserPlus className="size-4" />
              {submitting ? t("authWorking") : t("authSubmitSignUp")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="font-display text-sm text-muted-foreground text-center w-full">
            {t("authHaveAccount")}{" "}
            <Link
              href={`/sign-in?redirect=${encodeURIComponent(nextPath)}`}
              className="text-brand-red hover:underline font-medium"
            >
              {t("authSignInLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
