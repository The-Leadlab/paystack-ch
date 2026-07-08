import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { SeoNoIndex } from "@/components/SeoNoIndex";
import { checkAliLabSession } from "@/lib/aliLabGateClient";
import { getAliLabFeature, isExcludedAliLabFeature } from "@/ali-lab/featureRegistry";
import { AliLabFeaturePanel } from "@/ali-lab/AliLabFeaturePanels";
import { ExcludedFeaturePanel } from "@/ali-lab/features/ExcludedFeaturePanel";
import { AliLabShell } from "@/ali-lab/AliLabShell";
import { useLabLanguage } from "@/ali-lab/context/LabLanguageContext";
import { labFeatureCopy } from "@/ali-lab/i18n/labRegistryI18n";
import { PersonalPlanShell } from "@/ali-lab/personal-plan/components/PersonalPlanShell";

const KPI_HIDDEN_FEATURES = new Set(["forecasting", "investments", "goals", "bill-reminders", "session-tasks"]);

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

function AliLabPageContent() {
  const [, params] = useRoute("/ali/:featureId");
  const { lang } = useLabLanguage();
  const featureId = params?.featureId;
  const excluded = featureId ? isExcludedAliLabFeature(featureId) : false;
  const feature = excluded ? undefined : (getAliLabFeature(featureId) ?? getAliLabFeature("overview"));
  const activeCopy = feature ? labFeatureCopy(feature.id, lang) : undefined;
  const showKpi = !featureId || !KPI_HIDDEN_FEATURES.has(featureId);

  if (excluded && featureId) {
    return (
      <PersonalPlanShell surface="lab" featureId={featureId} title="Excluded feature">
        <ExcludedFeaturePanel featureId={featureId} />
      </PersonalPlanShell>
    );
  }

  if (!feature) return null;

  return (
    <PersonalPlanShell
      surface="lab"
      featureId={feature.id}
      title={activeCopy?.title ?? feature.title}
      showKpi={showKpi}
    >
      <AliLabFeaturePanel feature={feature} />
    </PersonalPlanShell>
  );
}

export default function AliLabPage() {
  const [, params] = useRoute("/ali/:featureId");
  const featureId = params?.featureId;
  const excluded = featureId ? isExcludedAliLabFeature(featureId) : false;
  const { allowed, checking } = useAliLabGate();

  useEffect(() => {
    if (!checking && !allowed) {
      const next = featureId && !excluded ? `/ali/${featureId}` : "/ali/overview";
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
