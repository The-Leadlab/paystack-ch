import { Link } from "wouter";
import { useAuth } from "@/cafe/context/AuthContext";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabLang } from "../i18n/labStrings";
import { LAB_LANG_DISPLAY } from "../i18n/labLangDisplay";

const LAB_LANGS: LabLang[] = ["en", "fr", "de", "it"];

export function AliLabAuthBanner({
  variant = "lab",
  signInRedirect = "/ali/overview",
}: {
  variant?: "lab" | "personal";
  signInRedirect?: string;
}) {
  const { user, loading } = useAuth();
  const { lang, setLang, t } = useLabLanguage();
  const signInHref = `/sign-in?redirect=${encodeURIComponent(signInRedirect)}`;

  if (variant === "personal") {
    return (
      <div className="flex flex-col gap-2.5 border-b border-[var(--pp-outline-variant)] bg-[var(--pp-surface-low)] px-4 md:px-16 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <p className="text-[11px] leading-relaxed text-[var(--pp-on-surface-variant)] min-w-0">
          {loading ? "…" : user ? `✓ ${t("firebaseOk")} (${user.email})` : `${t("localOnly")} — ${t("signInHint")}`}
        </p>
        {!user && (
          <Link
            href={signInHref}
            className="inline-flex items-center justify-center min-h-10 w-full sm:w-auto shrink-0 rounded-lg bg-[var(--pp-primary-container)] px-4 py-2 text-[11px] font-bold text-[var(--pp-on-primary-container)]"
          >
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
          <Link href={signInHref} className="text-brand-red font-bold uppercase">
            {t("signIn")}
          </Link>
        )}
      </div>
    </div>
  );
}
