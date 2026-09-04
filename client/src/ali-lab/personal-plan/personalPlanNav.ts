import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  PiggyBank,
  TrendingUp,
  Receipt,
  Settings,
  FlaskConical,
} from "lucide-react";

export type PersonalPlanSurface = "lab" | "app";

export type PersonalPlanNavItem = {
  id: string;
  /** i18n key in labStrings / LanguageContext via useLabLanguage().t */
  labelKey: string;
  icon: LucideIcon;
  featureId: string;
  /** Shown in the compact mobile bar (max 4 + more). */
  mobilePrimary?: boolean;
};

/** Primary nav — same features in lab (`/ali`) and production personal (`/personal`). */
export const PERSONAL_PLAN_NAV: PersonalPlanNavItem[] = [
  { id: "overview", labelKey: "navOverview", icon: LayoutDashboard, featureId: "overview", mobilePrimary: true },
  { id: "budget", labelKey: "navBudget", icon: Wallet, featureId: "budgeting", mobilePrimary: true },
  { id: "reports", labelKey: "navReports", icon: BarChart3, featureId: "forecasting" },
  { id: "savings", labelKey: "navSavings", icon: PiggyBank, featureId: "goals", mobilePrimary: true },
  { id: "investments", labelKey: "navInvestments", icon: TrendingUp, featureId: "investments" },
  { id: "bills", labelKey: "navBills", icon: Receipt, featureId: "bill-reminders", mobilePrimary: true },
  { id: "settings", labelKey: "navSettings", icon: Settings, featureId: "settings" },
];

export const PERSONAL_PLAN_DEFAULT_FEATURE = "overview";

export function personalFeaturePath(featureId: string, surface: PersonalPlanSurface): string {
  const base = surface === "app" ? "/personal" : "/ali";
  return `${base}/${featureId}`;
}

export function personalPlanNavHref(item: PersonalPlanNavItem, surface: PersonalPlanSurface): string {
  return personalFeaturePath(item.featureId, surface);
}

export const PERSONAL_PLAN_LAB_NAV: PersonalPlanNavItem = {
  id: "lab",
  labelKey: "navLabFeatures",
  icon: FlaskConical,
  featureId: "automation-rules",
};

export function isNavActive(item: PersonalPlanNavItem, featureId: string | undefined): boolean {
  return item.featureId === featureId;
}

/** Restaurant / platform dashboard (never under /personal). */
export function businessAppPath(): string {
  return "/app";
}

/** Production personal home (separated from /app). */
export function personalAppHomePath(): string {
  return personalFeaturePath(PERSONAL_PLAN_DEFAULT_FEATURE, "app");
}

export function personalHomePath(surface: PersonalPlanSurface): string {
  return personalFeaturePath(PERSONAL_PLAN_DEFAULT_FEATURE, surface);
}

/** True for `/personal/*` and legacy `/app/personal/*`. */
export function isPersonalAppPath(path: string): boolean {
  return (
    path === "/personal" ||
    path.startsWith("/personal/") ||
    path === "/app/personal" ||
    path.startsWith("/app/personal/")
  );
}

/** Map legacy `/app/personal/...` → `/personal/...`. */
export function canonicalizePersonalPath(path: string): string | null {
  if (path === "/app/personal") return "/personal/overview";
  if (path.startsWith("/app/personal/")) {
    return `/personal/${path.slice("/app/personal/".length)}` || "/personal/overview";
  }
  if (path === "/personal") return "/personal/overview";
  return null;
}

/** Feature id from `/personal/:id` or legacy `/app/personal/:id`. */
export function personalFeatureIdFromPath(path: string): string | undefined {
  const m = path.match(/^\/(?:app\/)?personal\/([^/?#]+)/);
  return m?.[1];
}
