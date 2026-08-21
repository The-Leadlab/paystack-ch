export type TourLength = "short" | "long" | "skip";

export type TourNavigate =
  | { kind: "biz-tab"; tab: string }
  | { kind: "personal-path"; path: string };

export type TourStep = {
  id: string;
  /** Matches `[data-tour="…"]` */
  target: string;
  /** i18n key — resolve with t() in ProductTourOverlay */
  titleKey: string;
  bodyKey: string;
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
    titleKey: "tourPerKpiTitle",
    bodyKey: "tourPerKpiBody",
    navigate: { kind: "personal-path", path: "/personal/overview" },
  },
  {
    id: "upload",
    target: "statement-upload",
    titleKey: "tourPerUploadTitle",
    bodyKey: "tourPerUploadBody",
  },
  {
    id: "budget",
    target: "nav-budgeting",
    titleKey: "tourPerBudgetTitle",
    bodyKey: "tourPerBudgetBody",
  },
  {
    id: "settings",
    target: "nav-settings",
    titleKey: "tourPerSettingsTitle",
    bodyKey: "tourPerSettingsBody",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    titleKey: "tourPerCollapseTitle",
    bodyKey: "tourPerCollapseBody",
  },
];

export const PERSONAL_TOUR_LONG: TourStep[] = [
  ...PERSONAL_TOUR_SHORT.slice(0, 2),
  {
    id: "nav-budget",
    target: "nav-budgeting",
    titleKey: "tourPerNavBudgetTitle",
    bodyKey: "tourPerNavBudgetBody",
  },
  {
    id: "panel-budget",
    target: "panel-budgeting",
    titleKey: "tourPerPanelBudgetTitle",
    bodyKey: "tourPerPanelBudgetBody",
    navigate: { kind: "personal-path", path: "/personal/budgeting" },
  },
  {
    id: "nav-reports",
    target: "nav-forecasting",
    titleKey: "tourPerNavReportsTitle",
    bodyKey: "tourPerNavReportsBody",
  },
  {
    id: "panel-reports",
    target: "panel-forecasting",
    titleKey: "tourPerPanelReportsTitle",
    bodyKey: "tourPerPanelReportsBody",
    navigate: { kind: "personal-path", path: "/personal/forecasting" },
  },
  {
    id: "nav-savings",
    target: "nav-goals",
    titleKey: "tourPerNavSavingsTitle",
    bodyKey: "tourPerNavSavingsBody",
  },
  {
    id: "panel-savings",
    target: "panel-goals",
    titleKey: "tourPerPanelSavingsTitle",
    bodyKey: "tourPerPanelSavingsBody",
    navigate: { kind: "personal-path", path: "/personal/goals" },
  },
  {
    id: "nav-invest",
    target: "nav-investments",
    titleKey: "tourPerNavInvestTitle",
    bodyKey: "tourPerNavInvestBody",
  },
  {
    id: "panel-invest",
    target: "panel-investments",
    titleKey: "tourPerPanelInvestTitle",
    bodyKey: "tourPerPanelInvestBody",
    navigate: { kind: "personal-path", path: "/personal/investments" },
  },
  {
    id: "nav-bills",
    target: "nav-bill-reminders",
    titleKey: "tourPerNavBillsTitle",
    bodyKey: "tourPerNavBillsBody",
  },
  {
    id: "panel-bills",
    target: "panel-bills",
    titleKey: "tourPerPanelBillsTitle",
    bodyKey: "tourPerPanelBillsBody",
    navigate: { kind: "personal-path", path: "/personal/bill-reminders" },
  },
  {
    id: "nav-settings",
    target: "nav-settings",
    titleKey: "tourPerNavSettingsTitle",
    bodyKey: "tourPerNavSettingsBody",
  },
  {
    id: "panel-settings",
    target: "panel-settings",
    titleKey: "tourPerPanelSettingsTitle",
    bodyKey: "tourPerPanelSettingsBody",
    navigate: { kind: "personal-path", path: "/personal/settings" },
  },
  {
    id: "add-tx",
    target: "add-transaction",
    titleKey: "tourPerAddTxTitle",
    bodyKey: "tourPerAddTxBody",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    titleKey: "tourPerCollapseTitle",
    bodyKey: "tourPerCollapseLongBody",
  },
];

export const BUSINESS_TOUR_SHORT: TourStep[] = [
  {
    id: "sessions",
    target: "sessions-list",
    titleKey: "tourBizSessionsTitle",
    bodyKey: "tourBizSessionsBody",
  },
  {
    id: "new-session",
    target: "new-session",
    titleKey: "tourBizNewSessionTitle",
    bodyKey: "tourBizNewSessionBody",
  },
  {
    id: "dashboard",
    target: "biz-nav-dashboard",
    titleKey: "tourBizDashboardTitle",
    bodyKey: "tourBizDashboardBody",
    navigate: { kind: "biz-tab", tab: "dashboard" },
  },
  {
    id: "docs-nav",
    target: "biz-nav-documents",
    titleKey: "tourBizDocsNavTitle",
    bodyKey: "tourBizDocsNavBody",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    titleKey: "tourBizCollapseTitle",
    bodyKey: "tourBizCollapseBody",
  },
];

export const BUSINESS_TOUR_LONG: TourStep[] = [
  ...BUSINESS_TOUR_SHORT.slice(0, 2),
  {
    id: "nav-dash",
    target: "biz-nav-dashboard",
    titleKey: "tourBizNavDashTitle",
    bodyKey: "tourBizNavDashBody",
    navigate: { kind: "biz-tab", tab: "dashboard" },
  },
  {
    id: "kpi",
    target: "biz-dashboard-kpi",
    titleKey: "tourBizKpiTitle",
    bodyKey: "tourBizKpiBody",
    navigate: { kind: "biz-tab", tab: "dashboard" },
  },
  {
    id: "vat",
    target: "biz-dashboard-vat",
    titleKey: "tourBizVatTitle",
    bodyKey: "tourBizVatBody",
  },
  {
    id: "sync",
    target: "biz-sync-ledger",
    titleKey: "tourBizSyncTitle",
    bodyKey: "tourBizSyncBody",
  },
  {
    id: "upload",
    target: "biz-doc-upload",
    titleKey: "tourBizUploadTitle",
    bodyKey: "tourBizUploadBody",
  },
  {
    id: "nav-rev",
    target: "biz-nav-revenue",
    titleKey: "tourBizNavRevTitle",
    bodyKey: "tourBizNavRevBody",
    navigate: { kind: "biz-tab", tab: "revenue" },
  },
  {
    id: "panel-rev",
    target: "biz-revenue-panel",
    titleKey: "tourBizPanelRevTitle",
    bodyKey: "tourBizPanelRevBody",
    navigate: { kind: "biz-tab", tab: "revenue" },
  },
  {
    id: "nav-exp",
    target: "biz-nav-expenses",
    titleKey: "tourBizNavExpTitle",
    bodyKey: "tourBizNavExpBody",
    navigate: { kind: "biz-tab", tab: "expenses" },
  },
  {
    id: "panel-exp",
    target: "biz-expenses-panel",
    titleKey: "tourBizPanelExpTitle",
    bodyKey: "tourBizPanelExpBody",
    navigate: { kind: "biz-tab", tab: "expenses" },
  },
  {
    id: "nav-inv",
    target: "biz-nav-invoices",
    titleKey: "tourBizNavInvTitle",
    bodyKey: "tourBizNavInvBody",
    navigate: { kind: "biz-tab", tab: "invoices" },
  },
  {
    id: "panel-inv",
    target: "biz-invoices-panel",
    titleKey: "tourBizPanelInvTitle",
    bodyKey: "tourBizPanelInvBody",
    navigate: { kind: "biz-tab", tab: "invoices" },
  },
  {
    id: "nav-rep",
    target: "biz-nav-reports",
    titleKey: "tourBizNavRepTitle",
    bodyKey: "tourBizNavRepBody",
    navigate: { kind: "biz-tab", tab: "reports" },
  },
  {
    id: "panel-rep",
    target: "biz-reports-panel",
    titleKey: "tourBizPanelRepTitle",
    bodyKey: "tourBizPanelRepBody",
    navigate: { kind: "biz-tab", tab: "reports" },
  },
  {
    id: "nav-docs",
    target: "biz-nav-documents",
    titleKey: "tourBizNavDocsTitle",
    bodyKey: "tourBizNavDocsBody",
    navigate: { kind: "biz-tab", tab: "documents" },
  },
  {
    id: "panel-docs",
    target: "biz-documents-panel",
    titleKey: "tourBizPanelDocsTitle",
    bodyKey: "tourBizPanelDocsBody",
    navigate: { kind: "biz-tab", tab: "documents" },
  },
  {
    id: "nav-bill",
    target: "biz-nav-billing",
    titleKey: "tourBizNavBillTitle",
    bodyKey: "tourBizNavBillBody",
    navigate: { kind: "biz-tab", tab: "billing" },
  },
  {
    id: "panel-bill",
    target: "biz-billing-panel",
    titleKey: "tourBizPanelBillTitle",
    bodyKey: "tourBizPanelBillBody",
    navigate: { kind: "biz-tab", tab: "billing" },
  },
  {
    id: "personal",
    target: "personal-link",
    titleKey: "tourBizPersonalTitle",
    bodyKey: "tourBizPersonalBody",
  },
  {
    id: "collapse",
    target: "sidebar-collapse",
    titleKey: "tourBizCollapseTitle",
    bodyKey: "tourBizCollapseLongBody",
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
