export type AliLabFeatureStatus = "scaffold" | "prototype" | "ready" | "promoted";

export type AliLabFeature = {
  id: string;
  title: string;
  competitors: string;
  priority: "high" | "medium" | "low";
  status: AliLabFeatureStatus;
  promoteTo: string;
  summary: string;
};

/** Ten competitor gaps — build & test here before promoting to `/app`. */
export const ALI_LAB_FEATURES: AliLabFeature[] = [
  {
    id: "bank-sync",
    title: "Bank synchronization",
    competitors: "Buxfer, BlueBudget (bLink), YNAB",
    priority: "high",
    status: "scaffold",
    promoteTo: "Documents tab + FinanceContext",
    summary: "Open Banking / bLink, CSV import, auto transaction sync",
  },
  {
    id: "budgeting",
    title: "Budgeting (budget vs actual)",
    competitors: "YNAB, BudgetCH, BlueBudget",
    priority: "high",
    status: "prototype",
    promoteTo: "New Budget tab in RestaurantDashboard",
    summary: "Monthly category budgets, variance, zero-based optional mode",
  },
  {
    id: "goals",
    title: "Goal tracking",
    competitors: "YNAB, Buxfer, BlueBudget",
    priority: "medium",
    status: "prototype",
    promoteTo: "Dashboard widget + Firestore goals collection",
    summary: "Savings targets, debt payoff, progress %",
  },
  {
    id: "forecasting",
    title: "Forecasting & cash flow",
    competitors: "Buxfer",
    priority: "medium",
    status: "scaffold",
    promoteTo: "Reports tab extension",
    summary: "90-day cash projection from historical income/expense",
  },
  {
    id: "bill-reminders",
    title: "Bill reminders",
    competitors: "Buxfer, BlueBudget",
    priority: "medium",
    status: "prototype",
    promoteTo: "Notifications + recurring bills collection",
    summary: "Serafe, insurance, rent — due dates & alerts",
  },
  {
    id: "shared-access",
    title: "Shared budgets / multi-user",
    competitors: "BudgetCH, YNAB Together, Buxfer, FairSplit",
    priority: "medium",
    status: "scaffold",
    promoteTo: "Firestore rules + invites + roles",
    summary: "Family/team access, accountant read-only, FairSplit expenses",
  },
  {
    id: "investments",
    title: "Investment tracking",
    competitors: "Buxfer",
    priority: "low",
    status: "scaffold",
    promoteTo: "Optional module under Reports",
    summary: "Holdings, portfolio value, simple performance",
  },
  {
    id: "de-it-i18n",
    title: "German & Italian (DE / IT)",
    competitors: "BudgetCH",
    priority: "medium",
    status: "prototype",
    promoteTo: "LanguageContext + full translation pass",
    summary: "Extend en|fr to de|it for Swiss market",
  },
  {
    id: "offline",
    title: "Offline capture & sync",
    competitors: "YNAB",
    priority: "low",
    status: "scaffold",
    promoteTo: "Service worker + IndexedDB queue",
    summary: "Queue uploads when offline, sync when online",
  },
  {
    id: "automation-rules",
    title: "User automation rules",
    competitors: "Buxfer",
    priority: "low",
    status: "scaffold",
    promoteTo: "Settings + rule engine on transaction import",
    summary: "If description contains X → category Y",
  },
];

export function getAliLabFeature(id: string | undefined): AliLabFeature | undefined {
  if (!id) return ALI_LAB_FEATURES[0];
  return ALI_LAB_FEATURES.find((f) => f.id === id);
}
