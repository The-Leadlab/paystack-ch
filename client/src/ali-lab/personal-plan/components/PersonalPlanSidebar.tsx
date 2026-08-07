import { useState } from "react";
import { Link } from "wouter";
import {
  Lock,
  Plus,
  Briefcase,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERSONAL_PLAN_NAV,
  businessAppPath,
  isNavActive,
  personalAppHomePath,
  personalHomePath,
  personalPlanNavHref,
  type PersonalPlanSurface,
} from "../personalPlanNav";
import { ALI_LAB_FEATURES } from "../../featureRegistry";
import { logoutAliLab } from "@/lib/aliLabGateClient";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { useCanOpenBusinessDashboard } from "@/cafe/hooks/useProductLineAccess";
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from "@/const/branding";

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
  showBusinessLink,
}: {
  surface: PersonalPlanSurface;
  featureId: string | undefined;
  onClose: () => void;
  showBusinessLink: boolean;
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
        className="absolute bottom-20 left-4 right-4 pp-glass-panel p-3 space-y-1"
        onClick={(e) => e.stopPropagation()}
      >
        {secondary.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={personalPlanNavHref(item, surface)}
              onClick={onClose}
              className={cn(
                "pp-nav-btn",
                isNavActive(item, featureId) && "pp-nav-active"
              )}
              data-active={isNavActive(item, featureId)}
            >
              <Icon className="size-3.5 shrink-0" />
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
          className="pp-sidebar-action pp-sidebar-action--primary mt-1"
        >
          <Plus className="size-3.5" />
          Add transaction
        </button>
        {surface === "app" ? (
          showBusinessLink ? (
            <Link
              href={businessAppPath()}
              onClick={onClose}
              className="pp-sidebar-action pp-sidebar-action--accent mt-1"
            >
              <Briefcase className="size-3.5" />
              Business dashboard
            </Link>
          ) : null
        ) : (
          <>
            <Link
              href={personalAppHomePath()}
              onClick={onClose}
              className="pp-sidebar-action pp-sidebar-action--muted mt-1"
            >
              <Briefcase className="size-3.5" />
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
              className="pp-sidebar-action pp-sidebar-action--muted"
            >
              <Lock className="size-3.5" />
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
  collapsed = false,
  onToggleCollapsed,
}: {
  featureId: string | undefined;
  surface?: PersonalPlanSurface;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { openTransaction } = usePersonalPlan();
  const showBusinessLink = useCanOpenBusinessDashboard();
  const lockLab = async () => {
    await logoutAliLab();
    window.location.href = "/ali-gate";
  };

  return (
    <aside
      data-tour="personal-sidebar"
      className={cn(
        "pp-sidebar hidden md:flex flex-col fixed left-0 top-0 h-screen z-50 gap-1.5 transition-[width] duration-200",
        collapsed ? "pp-sidebar--rail w-14 px-1.5 py-3" : "w-52 px-3 py-4"
      )}
    >
      <div
        className={cn(
          "flex items-center mb-2 shrink-0",
          collapsed ? "flex-col gap-1.5" : "justify-between gap-1"
        )}
      >
        <Link
          href={personalHomePath(surface)}
          className={cn("flex items-center hover:opacity-90 min-w-0", collapsed ? "justify-center" : "gap-2")}
          title="Paystack Personal"
        >
          <img
            src={BRAND_LOGO_SRC}
            alt="Paystack.ch"
            width={BRAND_LOGO_SIZE}
            height={BRAND_LOGO_SIZE}
            className={cn("object-contain shrink-0", collapsed ? "h-7 w-7" : "h-8 w-auto max-w-[120px]")}
          />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--pp-on-surface-variant)] truncate">
                {surface === "app" ? "Personal" : "Lab · Personal"}
              </p>
            </div>
          ) : null}
        </Link>
        {onToggleCollapsed ? (
          <button
            type="button"
            data-tour="sidebar-collapse"
            onClick={onToggleCollapsed}
            className="p-1.5 rounded border border-[var(--pp-border)] text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden" aria-label="Personal navigation">
        {PERSONAL_PLAN_NAV.map((item) => {
          const active = isNavActive(item, featureId);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={personalPlanNavHref(item, surface)}
              title={item.label}
              data-tour={`nav-${item.featureId}`}
              data-active={active}
              className={cn("pp-nav-btn", collapsed && "pp-nav-btn--rail", active && "pp-nav-active")}
            >
              <Icon className="size-3.5 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
        {surface === "lab" && !collapsed ? (
          <>
            <p className="px-2 pt-3 pb-1 text-[9px] uppercase tracking-widest text-[var(--pp-on-surface-variant)] opacity-60">
              Lab
            </p>
            {ALI_LAB_FEATURES.filter((f) => SECONDARY_FEATURE_IDS.has(f.id)).map((f) => (
              <Link
                key={f.id}
                href={`/ali/${f.id}`}
                data-active={featureId === f.id}
                className={cn("pp-nav-btn", featureId === f.id && "pp-nav-active")}
              >
                <span className="truncate">{f.title}</span>
              </Link>
            ))}
          </>
        ) : null}
      </nav>

      <div className="mt-auto space-y-1.5 pt-3 border-t border-[var(--pp-border)] shrink-0">
        <button
          type="button"
          data-tour="add-transaction"
          onClick={() => openTransaction()}
          title="Add transaction"
          className={cn(
            "pp-sidebar-action pp-sidebar-action--primary",
            collapsed && "pp-sidebar-action--rail"
          )}
        >
          <Plus className="size-3.5 shrink-0" />
          {!collapsed ? <span>Add transaction</span> : null}
        </button>
        {surface === "lab" ? (
          !collapsed ? (
            <>
              <Link href={businessAppPath()} className="pp-sidebar-action pp-sidebar-action--muted">
                <Briefcase className="size-3.5 shrink-0" />
                Business /app
              </Link>
              <Link href={personalAppHomePath()} className="pp-sidebar-action pp-sidebar-action--muted">
                <Briefcase className="size-3.5 shrink-0" />
                Production personal
              </Link>
              <button
                type="button"
                onClick={() => void lockLab()}
                className="pp-sidebar-action pp-sidebar-action--muted"
              >
                <Lock className="size-3.5 shrink-0" />
                Lock lab
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void lockLab()}
              title="Lock lab"
              className="pp-sidebar-action pp-sidebar-action--muted pp-sidebar-action--rail"
            >
              <Lock className="size-3.5" />
            </button>
          )
        ) : showBusinessLink ? (
          <Link
            href={businessAppPath()}
            title="Business dashboard"
            data-tour="business-link"
            className={cn(
              "pp-sidebar-action pp-sidebar-action--accent",
              collapsed && "pp-sidebar-action--rail"
            )}
          >
            <Briefcase className="size-3.5 shrink-0" />
            {!collapsed ? <span>Business dashboard</span> : null}
          </Link>
        ) : null}
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
  const showBusinessLink = useCanOpenBusinessDashboard();
  const primary = PERSONAL_PLAN_NAV.filter((item) => item.mobilePrimary);

  return (
    <>
      <nav
        className="pp-mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-between gap-1 px-1 pb-[env(safe-area-inset-bottom)] pt-1"
        aria-label="Personal mobile navigation"
      >
        {primary.map((item) => {
          const active = isNavActive(item, featureId);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={personalPlanNavHref(item, surface)}
              data-active={active}
              className="pp-mobile-nav-btn"
              aria-label={item.label}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="leading-tight text-center px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => openTransaction()}
          className="pp-mobile-nav-btn pp-mobile-nav-fab max-w-[3.5rem]"
          aria-label="Add transaction"
        >
          <Plus className="size-5" />
          <span>Add</span>
        </button>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="pp-mobile-nav-btn"
          aria-label="More"
        >
          <MoreHorizontal className="size-5" />
          <span>More</span>
        </button>
      </nav>
      {moreOpen ? (
        <PersonalPlanMoreSheet
          surface={surface}
          featureId={featureId}
          onClose={() => setMoreOpen(false)}
          showBusinessLink={showBusinessLink}
        />
      ) : null}
    </>
  );
}
