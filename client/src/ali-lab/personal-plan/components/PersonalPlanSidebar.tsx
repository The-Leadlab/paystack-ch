import type { ReactNode } from "react";
import { Link } from "wouter";
import { Lock, LogOut, Plus, Briefcase, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERSONAL_PLAN_NAV,
  businessAppPath,
  isNavActive,
  personalPlanNavHref,
  type PersonalPlanSurface,
} from "../personalPlanNav";
import { ALI_LAB_FEATURES } from "../../featureRegistry";
import { logoutAliLab } from "@/lib/aliLabGateClient";

const SECONDARY_FEATURE_IDS = new Set([
  "automation-rules",
  "shared-access",
  "offline",
  "de-it-i18n",
]);

export function PersonalPlanSidebar({
  featureId,
  surface = "lab",
}: {
  featureId: string | undefined;
  surface?: PersonalPlanSurface;
}) {
  const lockLab = async () => {
    await logoutAliLab();
    window.location.href = "/ali-gate";
  };

  const seen = new Set<string>();
  const navItems = PERSONAL_PLAN_NAV.filter((item) => {
    if (seen.has(item.featureId)) return false;
    seen.add(item.featureId);
    return true;
  });

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 z-50 bg-[var(--pp-surface-low)] border-r border-[var(--pp-outline-variant)] p-6 gap-2">
      <div className="flex items-center gap-3 px-1 mb-6">
        <div className="w-10 h-10 bg-[var(--pp-primary-container)] rounded-lg flex items-center justify-center shrink-0">
          <span className="text-[var(--pp-on-primary)] text-lg font-bold">P</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--pp-primary)] tracking-tight truncate">Paystack</h1>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] opacity-70">
            {surface === "app" ? "Personal finances" : "Private Wealth"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isNavActive(item, featureId);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={personalPlanNavHref(item, surface)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200",
                active
                  ? "pp-nav-active"
                  : "text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)]"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {surface === "lab" ? (
          <>
            <p className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-widest text-[var(--pp-on-surface-variant)] opacity-60">
              Lab prototypes
            </p>
            {ALI_LAB_FEATURES.filter((f) => SECONDARY_FEATURE_IDS.has(f.id)).map((f) => (
              <Link
                key={f.id}
                href={`/ali/${f.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-lg text-xs transition-colors",
                  featureId === f.id
                    ? "text-[var(--pp-primary)] bg-[var(--pp-surface-highest)]"
                    : "text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)]"
                )}
              >
                <span className="truncate">{f.title}</span>
              </Link>
            ))}
          </>
        ) : null}
      </nav>

      <div className="mt-auto space-y-1 pt-4 border-t border-[var(--pp-outline-variant)]">
        {surface === "app" ? (
          <Link
            href={businessAppPath()}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Briefcase className="size-4" />
            Business dashboard
          </Link>
        ) : (
          <>
            <button
              type="button"
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="size-4" />
              Add transaction
            </button>
            <Link
              href={businessAppPath()}
              className="flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
            >
              <Briefcase className="size-4" />
              Production /app
            </Link>
            <button
              type="button"
              onClick={() => void lockLab()}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
            >
              <Lock className="size-4" />
              Lock lab
            </button>
            <a
              href="/docs/PERSONAL_BUSINESS_LINK_SUPER_PROMPT.md"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
            >
              <HelpCircle className="size-4" />
              Link super prompt
            </a>
          </>
        )}
      </div>
    </aside>
  );
}

export function PersonalPlanMobileNav({
  featureId,
  surface = "lab",
}: {
  featureId: string | undefined;
  surface?: PersonalPlanSurface;
}) {
  const items = PERSONAL_PLAN_NAV.filter(
    (item, i, arr) => arr.findIndex((x) => x.featureId === item.featureId) === i
  ).slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-4 left-4 right-4 h-14 pp-glass-panel rounded-full flex items-center justify-around px-2 z-50">
      {items.map((item) => {
        const active = isNavActive(item, featureId);
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={personalPlanNavHref(item, surface)}
            className={cn(
              "p-2 rounded-full transition-colors",
              active ? "text-[var(--pp-primary)]" : "text-[var(--pp-on-surface-variant)]"
            )}
          >
            <Icon className="size-5" style={active ? { fill: "currentColor", opacity: 0.2 } : undefined} />
          </Link>
        );
      })}
      {surface === "app" ? (
        <Link href={businessAppPath()} className="p-2 text-[var(--pp-on-surface-variant)]" aria-label="Business">
          <Briefcase className="size-5" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void logoutAliLab().then(() => { window.location.href = "/ali-gate"; })}
          className="p-2 text-[var(--pp-on-surface-variant)]"
          aria-label="Lock lab"
        >
          <LogOut className="size-5" />
        </button>
      )}
    </nav>
  );
}
