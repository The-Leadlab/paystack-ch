export type AliLabFeatureStatus = "scaffold" | "prototype" | "ready" | "promoted";

/** Product decision: no bank API / CSV / Open Banking — do not implement. */
export const ALI_LAB_EXCLUDED_FEATURE_IDS = ["bank-sync"] as const;

export type AliLabFeature = {
  id: string;
  title: string;
  competitors: string;
  priority: "high" | "medium" | "low";
  status: AliLabFeatureStatus;
  promoteTo: string;
  summary: string;
};

/** Priority order: build & test here before promoting to `/app`. */
export const ALI_LAB_FEATURES: AliLabFeature[] = [
  {
    id: "budgeting",
    title: "Budgeting (budget vs actual)",
    competitors: "YNAB, BudgetCH, BlueBudget",
    priority: "high",
    status: "ready",
    promoteTo: "New Budget tab in RestaurantDashboard",
    summary: "Monthly category budgets vs Firestore expenses; traditional & zero-based modes",
  },
  {
    id: "bill-reminders",
    title: "Bill reminders",
    competitors: "Buxfer, BlueBudget",
    priority: "medium",
    status: "ready",
    promoteTo: "Notifications + recurring bills collection",
    summary: "Serafe, insurance, rent — due dates, overdue highlight, Firestore/local sync",
  },
  {
    id: "goals",
    title: "Goal tracking",
    competitors: "YNAB, Buxfer, BlueBudget",
    priority: "medium",
    status: "ready",
    promoteTo: "Dashboard widget + Firestore goals collection",
    summary: "Savings & debt goals with progress bars",
  },
  {
    id: "de-it-i18n",
    title: "German & Italian (DE / IT)",
    competitors: "BudgetCH",
    priority: "medium",
    status: "prototype",
    promoteTo: "LanguageContext + full translation pass",
    summary: "Lab i18n pack (en/fr/de/it) ready to merge into LanguageContext",
  },
  {
    id: "forecasting",
    title: "Forecasting & cash flow",
    competitors: "Buxfer",
    priority: "medium",
    status: "prototype",
    promoteTo: "Reports tab extension",
    summary: "90-day balance projection from ledger history",
  },
  {
    id: "automation-rules",
    title: "User automation rules",
    competitors: "Buxfer",
    priority: "low",
    status: "prototype",
    promoteTo: "Settings + rule engine on transaction import",
    summary: "If description contains X → category Y + keyword fallback test",
  },
  {
    id: "shared-access",
    title: "Shared budgets / multi-user",
    competitors: "BudgetCH, YNAB Together, Buxfer, FairSplit",
    priority: "medium",
    status: "prototype",
    promoteTo: "Firestore rules + invites + roles",
    summary: "Mock invites & FairSplit — workspace migration TBD",
  },
  {
    id: "offline",
    title: "Offline capture & sync",
    competitors: "YNAB",
    priority: "low",
    status: "prototype",
    promoteTo: "Service worker + IndexedDB queue",
    summary: "Simulated offline queue + flush when online",
  },
  {
    id: "investments",
    title: "Investment tracking",
    competitors: "Buxfer",
    priority: "low",
    status: "prototype",
    promoteTo: "Optional module under Reports",
    summary: "Holdings CRUD with portfolio total",
  },
];

export function isExcludedAliLabFeature(id: string): boolean {
  return (ALI_LAB_EXCLUDED_FEATURE_IDS as readonly string[]).includes(id);
}

export function getAliLabFeature(id: string | undefined): AliLabFeature | undefined {
  if (id && isExcludedAliLabFeature(id)) return undefined;
  if (!id) return ALI_LAB_FEATURES[0];
  return ALI_LAB_FEATURES.find((f) => f.id === id);
}
