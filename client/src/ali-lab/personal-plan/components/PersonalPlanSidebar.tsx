import { useState } from "react";
import { Link } from "wouter";
import { Lock, Plus, Briefcase, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERSONAL_PLAN_NAV,
  businessAppPath,
  isNavActive,
  personalHomePath,
  personalPlanNavHref,
  type PersonalPlanSurface,
} from "../personalPlanNav";
import { ALI_LAB_FEATURES } from "../../featureRegistry";
import { logoutAliLab } from "@/lib/aliLabGateClient";
import { usePersonalPlan } from "../context/PersonalPlanContext";

const SECONDARY_FEATURE_IDS = new Set([
  "automation-rules",
  "shared-access",
  "offline",
  "de-it-i18n",
]);

function PersonalPlanMoreSheet({
  surface,
  featureId,
  onClose,
}: {
  surface: PersonalPlanSurface;
  featureId: string | undefined;
  onClose: () => void;
}) {
  const { openTransaction } = usePersonalPlan();
  const secondary = PERSONAL_PLAN_NAV.filter((item) => !item.mobilePrimary && item.featureId !== "overview");

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 md:hidden"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="absolute bottom-20 left-4 right-4 pp-glass-panel rounded-2xl p-3 space-y-1"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--pp-on-surface-variant)]">
          More
        </p>
        {secondary.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={personalPlanNavHref(item, surface)}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                isNavActive(item, featureId)
                  ? "text-[var(--pp-primary)] bg-[var(--pp-surface-highest)]"
                  : "text-[var(--pp-on-surface)]"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            openTransaction();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--pp-on-surface)]"
        >
          <Plus className="size-4" />
          Add transaction
        </button>
        {surface === "app" ? (
          <Link
            href={businessAppPath()}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--pp-on-surface)]"
          >
            <Briefcase className="size-4" />
            Business dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/app/personal/overview"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--pp-on-surface)]"
            >
              <Briefcase className="size-4" />
              Production personal
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                void logoutAliLab().then(() => {
                  window.location.href = "/ali-gate";
                });
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--pp-on-surface)]"
            >
              <Lock className="size-4" />
              Lock lab
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PersonalPlanSidebar({
  featureId,
  surface = "lab",
}: {
  featureId: string | undefined;
  surface?: PersonalPlanSurface;
}) {
  const { openTransaction } = usePersonalPlan();
  const lockLab = async () => {
    await logoutAliLab();
    window.location.href = "/ali-gate";
  };

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 z-50 bg-[var(--pp-surface-low)] border-r border-[var(--pp-outline-variant)] p-6 gap-2">
      <Link href={personalHomePath(surface)} className="flex items-center gap-3 px-1 mb-6 hover:opacity-90">
        <div className="w-10 h-10 bg-[var(--pp-primary-container)] rounded-lg flex items-center justify-center shrink-0">
          <span className="text-[var(--pp-on-primary)] text-lg font-bold">P</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--pp-primary)] tracking-tight truncate">Paystack</h1>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] opacity-70">
            {surface === "app" ? "Personal finances" : "Private Wealth"}
          </p>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {PERSONAL_PLAN_NAV.map((item) => {
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
        <button
          type="button"
          onClick={() => openTransaction()}
          className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Plus className="size-4" />
          Add transaction
        </button>
        {surface === "lab" ? (
          <>
            <Link
              href={businessAppPath()}
              className="flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
            >
              <Briefcase className="size-4" />
              Business /app
            </Link>
            <Link
              href="/app/personal/overview"
              className="flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
            >
              <Briefcase className="size-4" />
              Production personal
            </Link>
            <button
              type="button"
              onClick={() => void lockLab()}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
            >
              <Lock className="size-4" />
              Lock lab
            </button>
          </>
        ) : (
          <Link
            href={businessAppPath()}
            className="flex items-center gap-3 px-4 py-2.5 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)] hover:bg-[var(--pp-surface-highest)] rounded-lg text-xs transition-colors"
          >
            <Briefcase className="size-4" />
            Business dashboard
          </Link>
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
  const { openTransaction } = usePersonalPlan();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = PERSONAL_PLAN_NAV.filter((item) => item.mobilePrimary);

  return (
    <>
      <nav className="md:hidden fixed bottom-4 left-4 right-4 h-14 pp-glass-panel rounded-full flex items-center justify-around px-1 z-50">
        {primary.map((item) => {
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
              aria-label={item.label}
            >
              <Icon className="size-5" style={active ? { fill: "currentColor", opacity: 0.2 } : undefined} />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => openTransaction()}
          className="p-2.5 rounded-full bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] -mt-6 shadow-lg"
          aria-label="Add transaction"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="p-2 rounded-full text-[var(--pp-on-surface-variant)]"
          aria-label="More"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </nav>
      {moreOpen ? (
        <PersonalPlanMoreSheet surface={surface} featureId={featureId} onClose={() => setMoreOpen(false)} />
      ) : null}
    </>
  );
}
