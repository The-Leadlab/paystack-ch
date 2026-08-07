import { getAliLabFeature } from "@/ali-lab/featureRegistry";
import {
  PERSONAL_PLAN_DEFAULT_FEATURE,
  personalFeatureIdFromPath,
} from "@/ali-lab/personal-plan/personalPlanNav";
import { AliLabFeaturePanel } from "@/ali-lab/AliLabFeaturePanels";
import { labFeatureCopy } from "@/ali-lab/i18n/labRegistryI18n";
import { LabLanguageProvider, useLabLanguage } from "@/ali-lab/context/LabLanguageContext";
import { PersonalPlanShell } from "@/ali-lab/personal-plan/components/PersonalPlanShell";
import { useLocation } from "wouter";

const KPI_HIDDEN_FEATURES = new Set([
  "forecasting",
  "investments",
  "goals",
  "bill-reminders",
  "settings",
]);

function PersonalAppContent() {
  const [location] = useLocation();
  const { lang } = useLabLanguage();
  const featureId = personalFeatureIdFromPath(location) ?? PERSONAL_PLAN_DEFAULT_FEATURE;
  const feature = getAliLabFeature(featureId) ?? getAliLabFeature(PERSONAL_PLAN_DEFAULT_FEATURE)!;
  const activeCopy = labFeatureCopy(feature.id, lang);
  const showKpi = !KPI_HIDDEN_FEATURES.has(feature.id);

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
