import { useRoute } from "wouter";
import { getAliLabFeature } from "@/ali-lab/featureRegistry";
import { PERSONAL_PLAN_DEFAULT_FEATURE } from "@/ali-lab/personal-plan/personalPlanNav";
import { AliLabFeaturePanel } from "@/ali-lab/AliLabFeaturePanels";
import { labFeatureCopy } from "@/ali-lab/i18n/labRegistryI18n";
import { LabLanguageProvider, useLabLanguage } from "@/ali-lab/context/LabLanguageContext";
import { PersonalPlanShell } from "@/ali-lab/personal-plan/components/PersonalPlanShell";

const KPI_HIDDEN_FEATURES = new Set(["forecasting", "investments", "goals", "bill-reminders"]);

function PersonalAppContent() {
  const [, params] = useRoute("/app/personal/:featureId");
  const { lang } = useLabLanguage();
  const featureId = params?.featureId;
  const feature = getAliLabFeature(featureId) ?? getAliLabFeature(PERSONAL_PLAN_DEFAULT_FEATURE)!;
  const activeCopy = labFeatureCopy(feature.id, lang);
  const showKpi = !featureId || !KPI_HIDDEN_FEATURES.has(featureId);

  return (
    <PersonalPlanShell
      surface="app"
      featureId={feature.id}
      title={activeCopy?.title ?? feature.title}
      showKpi={showKpi}
    >
      <AliLabFeaturePanel feature={feature} />
    </PersonalPlanShell>
  );
}

export default function PersonalAppPage() {
  return (
    <LabLanguageProvider>
      <PersonalAppContent />
    </LabLanguageProvider>
  );
}
