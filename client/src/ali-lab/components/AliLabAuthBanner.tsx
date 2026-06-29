import { Link } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabLang } from "../i18n/labStrings";
import { LAB_LANG_DISPLAY } from "../i18n/labLangDisplay";

const LAB_LANGS: LabLang[] = ["en", "fr", "de", "it"];

export function AliLabAuthBanner({ variant = "lab" }: { variant?: "lab" | "personal" }) {
  const { user, loading } = useAuth();
  const { lang, setLang, t } = useLabLanguage();

  if (variant === "personal") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pp-outline-variant)] bg-[var(--pp-surface-low)] px-4 md:px-16 py-2 text-[11px] text-[var(--pp-on-surface-variant)]">
        <span>
          {loading ? "…" : user ? `✓ ${t("firebaseOk")} (${user.email})` : `${t("localOnly")} — ${t("signInHint")}`}
        </span>
        {!user && (
          <Link href="/sign-in?redirect=/ali/budgeting" className="text-[var(--pp-primary)] font-semibold">
            {t("signIn")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        {loading ? "…" : user ? `✓ ${t("firebaseOk")} (${user.email})` : `${t("localOnly")} — ${t("signInHint")}`}
      </span>
      <div className="flex items-center gap-2">
        {LAB_LANGS.map((l) => {
          const label = LAB_LANG_DISPLAY[l];
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              title={l === "de" ? `${label.title} — ${t("langNotDutch")}` : label.title}
              className={`px-2 py-0.5 rounded uppercase font-bold ${
                lang === l ? "bg-brand-red text-white" : "border border-border"
              }`}
            >
              {label.short}
            </button>
          );
        })}
        {!user && (
          <Link href="/sign-in?redirect=/ali/budgeting" className="text-brand-red font-bold uppercase">
            {t("signIn")}
          </Link>
        )}
      </div>
    </div>
  );
}
