/**
 * Landing / marketing screenshots. Add files under `client/public/landing/`:
 * - screenshot-dashboard.png
 * - screenshot-reports.png
 * - screenshot-revenue-pos.png
 * - screenshot-expenses.jpg
 * - screenshot-documents.png
 * - screenshot-personal.jpg
 *
 * If a file is missing, `LandingScreenshot` falls back to prior bundled paths when deployed.
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
    primary: "/landing/screenshot-dashboard.png",
    fallback: "/manus-storage/Image28.04.2026at01.15_01_307b72f8.png",
  },
  reports: {
    primary: "/landing/screenshot-reports.png",
    fallback: "/manus-storage/Image28.04.2026at01.15(1)_1cbde1c4.png",
  },
  revenue: {
    primary: "/landing/screenshot-revenue-pos.png",
    fallback: "/manus-storage/Image28.04.2026at01.15(2)_7be623da.png",
  },
  expenses: {
    primary: "/landing/screenshot-expenses.jpg",
    fallback: "/landing/screenshot-reports.png",
  },
  documents: {
    primary: "/landing/screenshot-documents.png",
    fallback: "/manus-storage/Image28.04.2026at01.15_b2574f4b.png",
  },
  personal: {
    primary: "/landing/screenshot-personal.jpg",
    fallback: "/landing/screenshot-dashboard.png",
  },
};
