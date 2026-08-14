/**

 * Landing / marketing screenshots under `client/public/landing/`.

 * V7 = hardened single lockup (no ghost fringes) + upload hint matches /app (CSV).

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

    primary: "/landing/screenshot-dashboard-v7.jpg",

    fallback: "/landing/screenshot-dashboard-v7.jpg",

  },

  reports: {

    primary: "/landing/screenshot-reports-v7.jpg",

    fallback: "/landing/screenshot-dashboard-v7.jpg",

  },

  revenue: {

    primary: "/landing/screenshot-revenue-v7.jpg",

    fallback: "/landing/screenshot-dashboard-v7.jpg",

  },

  expenses: {

    primary: "/landing/screenshot-expenses-v7.jpg",

    fallback: "/landing/screenshot-revenue-v7.jpg",

  },

  documents: {

    primary: "/landing/screenshot-documents-v7.jpg",

    fallback: "/landing/screenshot-dashboard-v7.jpg",

  },

  personal: {

    primary: "/landing/screenshot-personal-v7.jpg",

    fallback: "/landing/screenshot-dashboard-v7.jpg",

  },

};


