import type { AliLabFeature } from "./featureRegistry";
import { BudgetingPanel } from "./features/BudgetingPanel";
import { PersonalDashboardPanel } from "./features/PersonalDashboardPanel";
import { BillRemindersPanel } from "./features/BillRemindersPanel";
import { GoalsPanel } from "./features/GoalsPanel";
import { ForecastingPanel } from "./features/ForecastingPanel";
import { DeItPanel } from "./features/DeItPanel";
import { AutomationRulesPanel } from "./features/AutomationRulesPanel";
import { SharedAccessPanel } from "./features/SharedAccessPanel";
import { OfflinePanel } from "./features/OfflinePanel";
import { InvestmentsPanel } from "./features/InvestmentsPanel";

export function AliLabFeaturePanel({ feature }: { feature: AliLabFeature }) {
  switch (feature.id) {
    case "overview":
      return <PersonalDashboardPanel feature={feature} />;
    case "budgeting":
      return <BudgetingPanel feature={feature} />;
    case "bill-reminders":
      return <BillRemindersPanel feature={feature} />;
    case "goals":
      return <GoalsPanel feature={feature} />;
    case "forecasting":
      return <ForecastingPanel feature={feature} />;
    case "de-it-i18n":
      return <DeItPanel feature={feature} />;
    case "automation-rules":
      return <AutomationRulesPanel feature={feature} />;
    case "shared-access":
      return <SharedAccessPanel feature={feature} />;
    case "offline":
      return <OfflinePanel feature={feature} />;
    case "investments":
      return <InvestmentsPanel feature={feature} />;
    default:
      return null;
  }
}
