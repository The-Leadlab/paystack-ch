/**
 * Landing / marketing screenshots under `client/public/landing/`.
 * V3 business app imagery (Dashboard, Revenue, Expenses, Reports, Documents).
 * Cache-bust by changing filenames when replacing shots.
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
    primary: "/landing/screenshot-dashboard.jpg",
    fallback: "/landing/screenshot-dashboard.jpg",
  },
  reports: {
    primary: "/landing/screenshot-reports.jpg",
    fallback: "/landing/screenshot-dashboard.jpg",
  },
  revenue: {
    primary: "/landing/screenshot-revenue-pos.jpg",
    fallback: "/landing/screenshot-dashboard.jpg",
  },
  expenses: {
    primary: "/landing/screenshot-expenses.jpg",
    fallback: "/landing/screenshot-revenue-pos.jpg",
  },
  documents: {
    primary: "/landing/screenshot-documents.jpg",
    fallback: "/landing/screenshot-dashboard.jpg",
  },
  personal: {
    primary: "/landing/screenshot-personal.jpg",
    fallback: "/landing/screenshot-dashboard.jpg",
  },
};
