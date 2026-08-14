/**
 * Landing / marketing screenshots under `client/public/landing/`.
 * V3 business app imagery (Dashboard, Revenue, Expenses, Reports, Documents).
 * Cache-bust by changing filenames when replacing shots (v4 = diamond-stack logo).
 */
export type LandingScreenKey =
  | "dashboard"
  | "reports"
  | "revenue"
  | "expenses"
  | "documents"
  | "personal";

export const LANDING_SCREENSHOTS: Record<
  LandingScreenKey,
  { primary: string; fallback: string }
> = {
  dashboard: {
    primary: "/landing/screenshot-dashboard-v4.jpg",
    fallback: "/landing/screenshot-dashboard-v4.jpg",
  },
  reports: {
    primary: "/landing/screenshot-reports-v4.jpg",
    fallback: "/landing/screenshot-dashboard-v4.jpg",
  },
  revenue: {
    primary: "/landing/screenshot-revenue-v4.jpg",
    fallback: "/landing/screenshot-dashboard-v4.jpg",
  },
  expenses: {
    primary: "/landing/screenshot-expenses-v4.jpg",
    fallback: "/landing/screenshot-revenue-v4.jpg",
  },
  documents: {
    primary: "/landing/screenshot-documents-v4.jpg",
    fallback: "/landing/screenshot-dashboard-v4.jpg",
  },
  personal: {
    primary: "/landing/screenshot-personal-v4.jpg",
    fallback: "/landing/screenshot-dashboard-v4.jpg",
  },
};
