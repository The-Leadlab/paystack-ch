import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { Lock, Loader2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PasswordField } from "@/components/PasswordField";
import { AuthLayout } from "./auth/AuthLayout";
import { verifyAdminUkPassword } from "@/lib/adminUkGateClient";
import { SeoNoIndex } from "@/components/SeoNoIndex";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function AdminUkGatePage() {
  const { t } = useLanguage();
  const search = useSearch();
  const next = (() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const n = new URLSearchParams(qs).get("next");
    return n && n.startsWith("/admin-uk") && !n.startsWith("//") ? n : "/admin-uk";
  })();

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await verifyAdminUkPassword(password);
      window.location.href = next;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SeoNoIndex />
      <AuthLayout
        heading="Admin UK — UAT"
        description="Password-gated UK tax system sandbox. GBP currency, UK VAT (0% / 5% / 20%), and UK-adapted Gemini extraction — for testing only until promoted to the live dashboard."
      >
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-uk-gate-password" className="font-display text-xs">
                  Admin UK password
                </Label>
                <PasswordField
                  id="admin-uk-gate-password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="font-editorial"
                  revealLabel={t("authShowPassword")}
                  hideLabel={t("authHidePassword")}
                />
              </div>
              {err ? <p className="text-sm text-destructive font-medium">{err}</p> : null}
              <Button
                type="submit"
                className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {busy ? "Checking…" : "Enter UK UAT"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-border flex-col gap-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Flag className="size-3" /> Password defaults to <code>admin UK</code> (
              <code>ADMIN_UK_PASSWORD</code>)
            </p>
            <Button asChild variant="ghost" size="sm" className="font-display text-muted-foreground">
              <Link href="/">{t("authBackHome")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthLayout>
    </>
  );
}
