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

export type PersonalPlanNavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  featureId: string;
};

/** Primary nav — maps Stitch sidebar to Ali lab feature routes. */
export const PERSONAL_PLAN_NAV: PersonalPlanNavItem[] = [
  { id: "dashboard", href: "/ali/budgeting", label: "Dashboard", icon: LayoutDashboard, featureId: "budgeting" },
  { id: "budget", href: "/ali/budgeting", label: "Budget", icon: Wallet, featureId: "budgeting" },
  { id: "reports", href: "/ali/forecasting", label: "Reports", icon: BarChart3, featureId: "forecasting" },
  { id: "savings", href: "/ali/goals", label: "Savings", icon: PiggyBank, featureId: "goals" },
  { id: "investments", href: "/ali/investments", label: "Investments", icon: TrendingUp, featureId: "investments" },
  { id: "bills", href: "/ali/bill-reminders", label: "Bills", icon: Receipt, featureId: "bill-reminders" },
];

export const PERSONAL_PLAN_LAB_NAV: PersonalPlanNavItem = {
  id: "lab",
  href: "/ali/automation-rules",
  label: "Lab features",
  icon: FlaskConical,
  featureId: "automation-rules",
};

export function isNavActive(item: PersonalPlanNavItem, featureId: string | undefined): boolean {
  return item.featureId === featureId;
}
