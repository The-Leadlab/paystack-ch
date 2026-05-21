import { Link } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabLang } from "../i18n/labStrings";

export function AliLabAuthBanner() {
  const { user, loading } = useAuth();
  const { lang, setLang, t } = useLabLanguage();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        {loading ? "…" : user ? `✓ ${t("firebaseOk")} (${user.email})` : `${t("localOnly")} — ${t("signInHint")}`}
      </span>
      <div className="flex items-center gap-2">
        {(["en", "fr", "de", "it"] as LabLang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`px-2 py-0.5 rounded uppercase font-bold ${
              lang === l ? "bg-brand-red text-white" : "border border-border"
            }`}
          >
            {l}
          </button>
        ))}
        {!user && (
          <Link href="/sign-in?redirect=/ali" className="text-brand-red font-bold uppercase">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
