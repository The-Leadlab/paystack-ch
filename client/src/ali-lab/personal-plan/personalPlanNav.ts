import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  PiggyBank,
  TrendingUp,
  Receipt,
  FlaskConical,
} from "lucide-react";

export type PersonalPlanSurface = "lab" | "app";

export type PersonalPlanNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  featureId: string;
};

/** Primary nav — same features in lab (`/ali`) and production personal (`/app/personal`). */
export const PERSONAL_PLAN_NAV: PersonalPlanNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, featureId: "budgeting" },
  { id: "budget", label: "Budget", icon: Wallet, featureId: "budgeting" },
  { id: "reports", label: "Reports", icon: BarChart3, featureId: "forecasting" },
  { id: "savings", label: "Savings", icon: PiggyBank, featureId: "goals" },
  { id: "investments", label: "Investments", icon: TrendingUp, featureId: "investments" },
  { id: "bills", label: "Bills", icon: Receipt, featureId: "bill-reminders" },
];

export function personalFeaturePath(featureId: string, surface: PersonalPlanSurface): string {
  const base = surface === "app" ? "/app/personal" : "/ali";
  return `${base}/${featureId}`;
}

export function personalPlanNavHref(item: PersonalPlanNavItem, surface: PersonalPlanSurface): string {
  return personalFeaturePath(item.featureId, surface);
}

export const PERSONAL_PLAN_LAB_NAV: PersonalPlanNavItem = {
  id: "lab",
  label: "Lab features",
  icon: FlaskConical,
  featureId: "automation-rules",
};

export function isNavActive(item: PersonalPlanNavItem, featureId: string | undefined): boolean {
  return item.featureId === featureId;
}

export function businessAppPath(): string {
  return "/app";
}
