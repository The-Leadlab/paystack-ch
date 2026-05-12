import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { LogIn } from "lucide-react";
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

export default function AdminSignInPage() {
  const { t } = useLanguage();
  const { user, loading, signIn, signInWithGoogle, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (isSubscriptionBypassEmail(user.email)) {
      setLocation("/app");
      return;
    }
    setError(t("authAdminUnauthorized"));
    void signOut();
  }, [loading, user, setLocation, signOut, t]);

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
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
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

  return (
    <AuthLayout heading={t("authAdminTitle")} description={t("authAdminDescription")}>
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
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
    </AuthLayout>
  );
}
