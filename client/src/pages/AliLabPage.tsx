import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  FlaskConical,
  Lock,
  ExternalLink,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoNoIndex } from "@/components/SeoNoIndex";
import { checkAliLabSession, logoutAliLab } from "@/lib/aliLabGateClient";
import { ALI_LAB_FEATURES, getAliLabFeature, isExcludedAliLabFeature } from "@/ali-lab/featureRegistry";
import { AliLabFeaturePanel } from "@/ali-lab/AliLabFeaturePanels";
import { ExcludedFeaturePanel } from "@/ali-lab/features/ExcludedFeaturePanel";
import { AliLabShell } from "@/ali-lab/AliLabShell";
import { useLabLanguage } from "@/ali-lab/context/LabLanguageContext";
import { labFeatureCopy, labStatusLabel } from "@/ali-lab/i18n/labRegistryI18n";

function useAliLabGate(): { allowed: boolean; checking: boolean } {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkAliLabSession().then((ok) => {
      if (!cancelled) {
        setAllowed(ok);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowed, checking };
}

function statusColor(status: string): string {
  switch (status) {
    case "prototype":
      return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
    case "ready":
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    case "promoted":
      return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function AliLabPageContent() {
  const [, params] = useRoute("/ali/:featureId");
  const featureId = params?.featureId;
  const excluded = featureId ? isExcludedAliLabFeature(featureId) : false;
  const feature = excluded ? undefined : (getAliLabFeature(featureId) ?? ALI_LAB_FEATURES[0]);
  const { lang, t } = useLabLanguage();

  const lockLab = async () => {
    await logoutAliLab();
    window.location.href = "/ali-gate";
  };

  const activeCopy = feature ? labFeatureCopy(feature.id, lang) : undefined;

  return (
    <div className="flex flex-col md:flex-row -mx-4 md:-mx-6">
      <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border bg-card/50 p-4 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="size-5 text-brand-red" />
          <h1 className="font-display text-sm font-bold uppercase tracking-wider">{t("labTitle")}</h1>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed">{t("labIntro")}</p>
        <nav className="space-y-1 max-h-[50vh] md:max-h-none overflow-y-auto">
          {ALI_LAB_FEATURES.map((f) => {
            const copy = labFeatureCopy(f.id, lang);
            return (
              <Link
                key={f.id}
                href={`/ali/${f.id}`}
                className={`flex items-center gap-2 px-2 py-2 rounded text-xs font-medium transition-colors ${
                  feature && f.id === feature.id ? "bg-brand-red/10 text-brand-red" : "hover:bg-muted"
                }`}
              >
                <ChevronRight className="size-3 shrink-0 opacity-50" />
                <span className="flex-1 truncate">{copy?.title ?? f.title}</span>
                <span className={`text-[9px] uppercase px-1 rounded ${statusColor(f.status)}`}>
                  {labStatusLabel(f.status, lang)}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
            <a href="/docs/I18N_SUPER_PROMPT.md" target="_blank" rel="noreferrer">
              <FileText className="size-3" /> {t("superPromptRepo")}
            </a>
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
            <Link href="/app">
              <ExternalLink className="size-3" /> {t("productionApp")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => void lockLab()}>
            <Lock className="size-3" /> {t("lockLab")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {excluded && featureId ? (
          <ExcludedFeaturePanel featureId={featureId} />
        ) : feature ? (
          <>
            <header className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {feature.priority} {t("priorityVs")} {feature.competitors}
              </p>
              <h2 className="font-display text-2xl font-bold mt-1">{activeCopy?.title ?? feature.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {t("promoteToLabel")}{" "}
                <code className="text-foreground">{activeCopy?.promoteTo ?? feature.promoteTo}</code>
              </p>
            </header>
            <AliLabFeaturePanel feature={feature} />
          </>
        ) : null}
        {!excluded && feature ? (
          <section className="mt-8 border border-border rounded-lg p-4 bg-muted/30">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2">{t("beforePromotionTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-2">{t("beforePromotionBody")}</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>{t("promoCheckFirebase")}</li>
              <li>{t("promoCheckPlans")}</li>
              <li>{t("promoCheckI18n")}</li>
              <li>{t("promoCheckMove")}</li>
              <li>{t("promoCheckStatus")}</li>
            </ol>
            <Button variant="outline" className="mt-4 text-xs font-bold uppercase" size="sm" asChild>
              <Link href="/app">
                <ExternalLink className="size-3 mr-1" /> {t("compareProduction")}
              </Link>
            </Button>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default function AliLabPage() {
  const [, params] = useRoute("/ali/:featureId");
  const featureId = params?.featureId;
  const excluded = featureId ? isExcludedAliLabFeature(featureId) : false;
  const { allowed, checking } = useAliLabGate();

  useEffect(() => {
    if (!checking && !allowed) {
      const next = featureId && !excluded ? `/ali/${featureId}` : "/ali/budgeting";
      window.location.href = `/ali-gate?next=${encodeURIComponent(next)}`;
    }
  }, [checking, allowed, featureId, excluded]);

  if (checking) {
    return (
      <AliLabShell>
        <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">
          <LabLoading />
        </div>
      </AliLabShell>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <AliLabShell>
      <SeoNoIndex />
      <AliLabPageContent />
    </AliLabShell>
  );
}

function LabLoading() {
  const { t } = useLabLanguage();
  return <>{t("loadingLab")}</>;
}
