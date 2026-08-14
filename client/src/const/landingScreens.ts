/**
 * Landing / marketing screenshots under `client/public/landing/`.
 * V5 = diamond-stack lockup (on-dark) matching /app dark chrome.
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
    primary: "/landing/screenshot-dashboard-v5.jpg",
    fallback: "/landing/screenshot-dashboard-v5.jpg",
  },
  reports: {
    primary: "/landing/screenshot-reports-v5.jpg",
    fallback: "/landing/screenshot-dashboard-v5.jpg",
  },
  revenue: {
    primary: "/landing/screenshot-revenue-v5.jpg",
    fallback: "/landing/screenshot-dashboard-v5.jpg",
  },
  expenses: {
    primary: "/landing/screenshot-expenses-v5.jpg",
    fallback: "/landing/screenshot-revenue-v5.jpg",
  },
  documents: {
    primary: "/landing/screenshot-documents-v5.jpg",
    fallback: "/landing/screenshot-dashboard-v5.jpg",
  },
  personal: {
    primary: "/landing/screenshot-personal-v5.jpg",
    fallback: "/landing/screenshot-dashboard-v5.jpg",
  },
};
