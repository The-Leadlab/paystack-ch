import { useRoute } from "wouter";
import { ALI_LAB_FEATURES, getAliLabFeature } from "@/ali-lab/featureRegistry";
import { AliLabFeaturePanel } from "@/ali-lab/AliLabFeaturePanels";
import { labFeatureCopy } from "@/ali-lab/i18n/labRegistryI18n";
import { LabLanguageProvider } from "@/ali-lab/context/LabLanguageContext";
import { PersonalPlanShell } from "@/ali-lab/personal-plan/components/PersonalPlanShell";

const KPI_HIDDEN_FEATURES = new Set(["forecasting", "investments", "goals", "bill-reminders"]);

export default function PersonalAppPage() {
  const [, params] = useRoute("/app/personal/:featureId");
  const featureId = params?.featureId;
  const feature = getAliLabFeature(featureId) ?? ALI_LAB_FEATURES.find((f) => f.id === "budgeting")!;
  const activeCopy = labFeatureCopy(feature.id, "en");
  const showKpi = !featureId || !KPI_HIDDEN_FEATURES.has(featureId);

  return (
    <LabLanguageProvider>
      <PersonalPlanShell
        surface="app"
        featureId={feature.id}
        title={activeCopy?.title ?? feature.title}
        showKpi={showKpi}
      >
        <AliLabFeaturePanel feature={feature} />
      </PersonalPlanShell>
    </LabLanguageProvider>
  );
}
