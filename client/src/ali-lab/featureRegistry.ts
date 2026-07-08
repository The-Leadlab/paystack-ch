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
    id: "overview",
    title: "Personal overview",
    competitors: "YNAB, BudgetCH",
    priority: "high",
    status: "ready",
    promoteTo: "Personal dashboard home at /app/personal",
    summary: "Month at a glance — quick actions, recent transactions, links to every personal module",
  },
  {
    id: "budgeting",
    title: "Budgeting (budget vs actual)",
    competitors: "YNAB, BudgetCH, BlueBudget",
    priority: "high",
    status: "ready",
    promoteTo: "New Budget tab in personal dashboard (/app)",
    summary:
      "Household budgets vs live expenses — bills, rent, groceries, going out, shopping, savings/invest; income expected (salary, assets, contributions)",
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
    status: "ready",
    promoteTo: "LanguageContext + full translation pass",
    summary: "Lab i18n pack (en/fr/de/it) ready to merge into LanguageContext",
  },
  {
    id: "forecasting",
    title: "Forecasting & cash flow",
    competitors: "Buxfer",
    priority: "medium",
    status: "ready",
    promoteTo: "Reports tab extension",
    summary: "90-day balance projection from ledger history",
  },
  {
    id: "automation-rules",
    title: "User automation rules",
    competitors: "Buxfer",
    priority: "low",
    status: "ready",
    promoteTo: "Settings + rule engine on transaction import",
    summary: "If description contains X → category Y + keyword fallback test",
  },
  {
    id: "shared-access",
    title: "Shared budgets / multi-user",
    competitors: "BudgetCH, YNAB Together, Buxfer, FairSplit",
    priority: "medium",
    status: "ready",
    promoteTo: "Firestore rules + invites + roles",
    summary: "Workspace members + FairSplit settlements synced to Firestore; uses live expense amounts",
  },
  {
    id: "offline",
    title: "Offline capture & sync",
    competitors: "YNAB",
    priority: "low",
    status: "ready",
    promoteTo: "Service worker + IndexedDB queue",
    summary: "Offline queue in Firestore; flush marks synced; shows /app document library count",
  },
  {
    id: "investments",
    title: "Investment tracking",
    competitors: "Buxfer",
    priority: "low",
    status: "ready",
    promoteTo: "Optional module under Reports",
    summary: "Holdings with cost basis, P/L, allocation %, and price updates",
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
