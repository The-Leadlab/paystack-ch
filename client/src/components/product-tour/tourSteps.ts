export type TourStep = {
  id: string;
  /** Matches `[data-tour="…"]` */
  target: string;
  title: string;
  body: string;
};

export const PERSONAL_TOUR_DONE_KEY = "paystack-personal-tour-done";
export const BUSINESS_TOUR_DONE_KEY = "paystack-business-tour-done";

export const PERSONAL_TOUR_STEPS: TourStep[] = [
  {
    id: "kpi",
    target: "overview-kpi",
    title: "Your month at a glance",
    body: "Income, expenses, savings, and balance update from statement imports and manual transactions.",
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
    id: "reports",
    target: "nav-forecasting",
    title: "Reports",
    body: "Charts and trends across the months you have imported.",
  },
  {
    id: "savings",
    target: "nav-goals",
    title: "Savings goals",
    body: "Track targets separately from day-to-day spending.",
  },
  {
    id: "investments",
    target: "nav-investments",
    title: "Investments",
    body: "Optional holdings view for personal portfolios.",
  },
  {
    id: "bills",
    target: "nav-bill-reminders",
    title: "Bills",
    body: "Reminders for recurring personal payments.",
  },
  {
    id: "settings",
    target: "nav-settings",
    title: "Settings",
    body: "Drive backup, invites, billing add-ons, and restart this tour.",
  },
  {
    id: "add-tx",
    target: "add-transaction",
    title: "Add a transaction",
    body: "Quick manual entry when you do not have a statement yet.",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    title: "Collapse the sidebar",
    body: "Switch to an icon rail when you need a wider workspace.",
  },
];

export const BUSINESS_TOUR_STEPS: TourStep[] = [
  {
    id: "sessions",
    target: "sessions-list",
    title: "Sessions",
    body: "Organize documents and ledgers by period. Pick a session to filter the dashboard.",
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
  },
  {
    id: "revenue",
    target: "biz-nav-revenue",
    title: "Revenue",
    body: "Restaurant income — separate from personal bank statements.",
  },
  {
    id: "expenses",
    target: "biz-nav-expenses",
    title: "Expenses",
    body: "Supplier costs and payroll linked to your sessions.",
  },
  {
    id: "documents",
    target: "biz-nav-documents",
    title: "Documents",
    body: "Upload and AI-process receipts and invoices.",
  },
  {
    id: "billing",
    target: "biz-nav-billing",
    title: "Billing",
    body: "Plan, seats, and Drive connection for the business workspace.",
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
    body: "Icon rail frees horizontal space on desktop.",
  },
];

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
export function requestProductTour(storageKey: string): void {
  resetTourDone(storageKey);
  try {
    window.dispatchEvent(
      new CustomEvent("paystack-product-tour-start", { detail: storageKey })
    );
  } catch {
    /* ignore */
  }
}
