import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { Lock, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AuthLayout } from "./auth/AuthLayout";
import { verifyAliLabPassword } from "@/lib/aliLabGateClient";
import { SeoNoIndex } from "@/components/SeoNoIndex";

export default function AliGatePage() {
  const search = useSearch();
  const next = (() => {
    const qs = search.startsWith("?") ? search.slice(1) : search;
    const n = new URLSearchParams(qs).get("next");
    return n && n.startsWith("/ali") && !n.startsWith("//") ? n : "/ali";
  })();

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await verifyAliLabPassword(password);
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
        heading="Ali feature lab"
        description="Password-protected sandbox for the 10 competitor-gap features. Test here before promoting to /app."
      >
        <Card className="border-border shadow-sm max-w-lg mx-auto">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ali-gate-password" className="font-display text-xs">
                  Lab password
                </Label>
                <Input
                  id="ali-gate-password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="font-editorial"
                />
              </div>
              {err ? <p className="text-sm text-destructive font-medium">{err}</p> : null}
              <Button
                type="submit"
                className="w-full font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {busy ? "Checking…" : "Enter lab"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-border flex-col gap-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FlaskConical className="size-3" /> Set <code>ALI_LAB_PASSWORD</code> on server (see .env.example)
            </p>
            <Button asChild variant="ghost" size="sm" className="font-display text-muted-foreground">
              <Link href="/">Back home</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthLayout>
    </>
  );
}
