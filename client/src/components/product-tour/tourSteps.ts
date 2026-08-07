export type TourLength = "short" | "long" | "skip";

export type TourNavigate =
  | { kind: "biz-tab"; tab: string }
  | { kind: "personal-path"; path: string };

export type TourStep = {
  id: string;
  /** Matches `[data-tour="…"]` */
  target: string;
  title: string;
  body: string;
  /** Run before measuring the target (switch tab / route). */
  navigate?: TourNavigate;
};

export const PERSONAL_TOUR_DONE_KEY = "paystack-personal-tour-done";
export const BUSINESS_TOUR_DONE_KEY = "paystack-business-tour-done";
export const PERSONAL_TOUR_LENGTH_KEY = "paystack-personal-tour-length";
export const BUSINESS_TOUR_LENGTH_KEY = "paystack-business-tour-length";

/** Always allow replaying guides for this account. */
export const PRODUCT_GUIDE_TESTER_EMAIL = "ali@the-leadlab.com";

export function shouldForceProductGuides(email?: string | null): boolean {
  return (email || "").trim().toLowerCase() === PRODUCT_GUIDE_TESTER_EMAIL;
}

export function readTourLength(key: string): TourLength | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v === "short" || v === "long" || v === "skip") return v;
    return null;
  } catch {
    return null;
  }
}

export function writeTourLength(key: string, length: TourLength): void {
  try {
    window.localStorage.setItem(key, length);
  } catch {
    /* ignore */
  }
}

export const PERSONAL_TOUR_SHORT: TourStep[] = [
  {
    id: "kpi",
    target: "overview-kpi",
    title: "Your month at a glance",
    body: "Income, expenses, savings, and balance update from statement imports and manual transactions.",
    navigate: { kind: "personal-path", path: "/personal/overview" },
  },
  {
    id: "upload",
    target: "statement-upload",
    title: "Upload a statement",
    body: "Drop a bank CSV or PDF here. Imports stay on your personal ledger — never Business Revenue.",
  },
  {
    id: "budget",
    target: "nav-budgeting",
    title: "Budget",
    body: "Set category limits and watch spend against your personal categories.",
  },
  {
    id: "settings",
    target: "nav-settings",
    title: "Settings",
    body: "Drive backup, invites, billing add-ons, and restart this tour.",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    title: "Collapse the sidebar",
    body: "Switch to an icon rail when you need a wider workspace.",
  },
];

export const PERSONAL_TOUR_LONG: TourStep[] = [
  ...PERSONAL_TOUR_SHORT.slice(0, 2),
  {
    id: "nav-budget",
    target: "nav-budgeting",
    title: "Budget tab",
    body: "Open Budget to manage category limits.",
  },
  {
    id: "panel-budget",
    target: "panel-budgeting",
    title: "Budget workspace",
    body: "Suggest limits from statements, switch traditional / zero-based, and edit categories.",
    navigate: { kind: "personal-path", path: "/personal/budgeting" },
  },
  {
    id: "nav-reports",
    target: "nav-forecasting",
    title: "Reports tab",
    body: "Projected cash and trends live here.",
  },
  {
    id: "panel-reports",
    target: "panel-forecasting",
    title: "Reports chart",
    body: "90-day projection and category breakdowns from your ledger.",
    navigate: { kind: "personal-path", path: "/personal/forecasting" },
  },
  {
    id: "nav-savings",
    target: "nav-goals",
    title: "Savings tab",
    body: "Goals use surplus from your personal month.",
  },
  {
    id: "panel-savings",
    target: "panel-goals",
    title: "Savings goals",
    body: "Create goals and track progress against surplus.",
    navigate: { kind: "personal-path", path: "/personal/goals" },
  },
  {
    id: "nav-invest",
    target: "nav-investments",
    title: "Investments tab",
    body: "Optional portfolio tracking.",
  },
  {
    id: "panel-invest",
    target: "panel-investments",
    title: "Investments panel",
    body: "Holdings and P/L stay personal — never mixed into restaurant Revenue.",
    navigate: { kind: "personal-path", path: "/personal/investments" },
  },
  {
    id: "nav-bills",
    target: "nav-bill-reminders",
    title: "Bills tab",
    body: "Recurring personal payment reminders.",
  },
  {
    id: "panel-bills",
    target: "panel-bills",
    title: "Bills panel",
    body: "Add reminders and see annual cost at a glance.",
    navigate: { kind: "personal-path", path: "/personal/bill-reminders" },
  },
  {
    id: "nav-settings",
    target: "nav-settings",
    title: "Settings tab",
    body: "Drive, household invite, and restart tour.",
  },
  {
    id: "panel-settings",
    target: "panel-settings",
    title: "Settings panel",
    body: "Sessions, language, Drive backup, and help controls.",
    navigate: { kind: "personal-path", path: "/personal/settings" },
  },
  {
    id: "add-tx",
    target: "add-transaction",
    title: "Add a transaction",
    body: "Quick manual entry from the sidebar.",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    title: "Collapse the sidebar",
    body: "Icon rail frees space — same pattern as Business.",
  },
];

export const BUSINESS_TOUR_SHORT: TourStep[] = [
  {
    id: "sessions",
    target: "sessions-list",
    title: "Sessions",
    body: "Organize documents and ledgers by period.",
  },
  {
    id: "new-session",
    target: "new-session",
    title: "New session",
    body: "Start a fresh period for uploads and bookkeeping.",
  },
  {
    id: "dashboard",
    target: "biz-nav-dashboard",
    title: "Dashboard",
    body: "VAT, balance, and document verification for the active session.",
    navigate: { kind: "biz-tab", tab: "dashboard" },
  },
  {
    id: "docs-nav",
    target: "biz-nav-documents",
    title: "Documents",
    body: "Upload and AI-process receipts and invoices.",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    title: "Collapse the sidebar",
    body: "Icon rail only — the dashboard expands to fill the width.",
  },
];

export const BUSINESS_TOUR_LONG: TourStep[] = [
  ...BUSINESS_TOUR_SHORT.slice(0, 2),
  {
    id: "nav-dash",
    target: "biz-nav-dashboard",
    title: "Dashboard tab",
    body: "Home for KPIs, VAT, and uploads.",
    navigate: { kind: "biz-tab", tab: "dashboard" },
  },
  {
    id: "kpi",
    target: "biz-dashboard-kpi",
    title: "Income & balance",
    body: "Session totals for income, expenses, payroll, and balance.",
    navigate: { kind: "biz-tab", tab: "dashboard" },
  },
  {
    id: "vat",
    target: "biz-dashboard-vat",
    title: "VAT cards",
    body: "Received, paid, and net VAT for Swiss filings.",
  },
  {
    id: "sync",
    target: "biz-sync-ledger",
    title: "Sync ledger",
    body: "Rebuild income/expenses from completed documents when needed.",
  },
  {
    id: "upload",
    target: "biz-doc-upload",
    title: "Document drop zone",
    body: "Drop PDF / JPG / PNG, then start processing.",
  },
  {
    id: "nav-rev",
    target: "biz-nav-revenue",
    title: "Revenue tab",
    body: "Restaurant income — never personal bank statements.",
    navigate: { kind: "biz-tab", tab: "revenue" },
  },
  {
    id: "panel-rev",
    target: "biz-revenue-panel",
    title: "Revenue workspace",
    body: "POS / sector revenue for the active session.",
    navigate: { kind: "biz-tab", tab: "revenue" },
  },
  {
    id: "nav-exp",
    target: "biz-nav-expenses",
    title: "Expenses tab",
    body: "Supplier costs and payroll.",
    navigate: { kind: "biz-tab", tab: "expenses" },
  },
  {
    id: "panel-exp",
    target: "biz-expenses-panel",
    title: "Expenses workspace",
    body: "Browse and edit business expenses linked to sessions.",
    navigate: { kind: "biz-tab", tab: "expenses" },
  },
  {
    id: "nav-inv",
    target: "biz-nav-invoices",
    title: "Invoices tab",
    body: "Create client invoices from the business ledger.",
    navigate: { kind: "biz-tab", tab: "invoices" },
  },
  {
    id: "panel-inv",
    target: "biz-invoices-panel",
    title: "Invoice maker",
    body: "Build and export invoices for customers.",
    navigate: { kind: "biz-tab", tab: "invoices" },
  },
  {
    id: "nav-rep",
    target: "biz-nav-reports",
    title: "Reports tab",
    body: "Business reporting and exports.",
    navigate: { kind: "biz-tab", tab: "reports" },
  },
  {
    id: "panel-rep",
    target: "biz-reports-panel",
    title: "Reports",
    body: "Session and VAT-oriented reports.",
    navigate: { kind: "biz-tab", tab: "reports" },
  },
  {
    id: "nav-docs",
    target: "biz-nav-documents",
    title: "Documents tab",
    body: "Full document list and verification.",
    navigate: { kind: "biz-tab", tab: "documents" },
  },
  {
    id: "panel-docs",
    target: "biz-documents-panel",
    title: "Documents list",
    body: "Open, verify, and manage processed files.",
    navigate: { kind: "biz-tab", tab: "documents" },
  },
  {
    id: "nav-bill",
    target: "biz-nav-billing",
    title: "Billing tab",
    body: "Plan, seats, and Drive for the business workspace.",
    navigate: { kind: "biz-tab", tab: "billing" },
  },
  {
    id: "panel-bill",
    target: "biz-billing-panel",
    title: "Billing panel",
    body: "Subscription and Google Drive connection.",
    navigate: { kind: "biz-tab", tab: "billing" },
  },
  {
    id: "personal",
    target: "personal-link",
    title: "Personal finances",
    body: "Jump to /personal when your plan includes the personal bridge.",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    title: "Collapse the sidebar",
    body: "Only icons remain; the dashboard grows.",
  },
];

/** @deprecated use PERSONAL_TOUR_SHORT */
export const PERSONAL_TOUR_STEPS = PERSONAL_TOUR_SHORT;
/** @deprecated use BUSINESS_TOUR_SHORT */
export const BUSINESS_TOUR_STEPS = BUSINESS_TOUR_SHORT;

export function stepsForLength(
  surface: "personal" | "business",
  length: TourLength | null
): TourStep[] {
  if (length === "long") {
    return surface === "personal" ? PERSONAL_TOUR_LONG : BUSINESS_TOUR_LONG;
  }
  return surface === "personal" ? PERSONAL_TOUR_SHORT : BUSINESS_TOUR_SHORT;
}

export function readTourDone(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeTourDone(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function resetTourDone(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Clears done flag and asks the matching shell to start the tour. */
export function requestProductTour(storageKey: string, length?: TourLength): void {
  resetTourDone(storageKey);
  if (length) {
    const lengthKey =
      storageKey === PERSONAL_TOUR_DONE_KEY
        ? PERSONAL_TOUR_LENGTH_KEY
        : BUSINESS_TOUR_LENGTH_KEY;
    writeTourLength(lengthKey, length);
  }
  try {
    window.dispatchEvent(
      new CustomEvent("paystack-product-tour-start", { detail: storageKey })
    );
  } catch {
    /* ignore */
  }
}
