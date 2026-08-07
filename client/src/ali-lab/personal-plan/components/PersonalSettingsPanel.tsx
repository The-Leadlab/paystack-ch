import { Briefcase, Moon, Sun, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useLabLanguage } from "../../context/LabLanguageContext";
import type { LabLang } from "../../i18n/labStrings";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { PERSONAL_BASE_DOC_LIMIT } from "@shared/planCatalog";
import { useSubscription } from "@/cafe/context/SubscriptionContext";
import { useCanOpenBusinessDashboard } from "@/cafe/hooks/useProductLineAccess";
import { businessAppPath } from "../personalPlanNav";
import { GlassCard } from "./GlassCard";
import { PersonalGoogleDrivePanel } from "./PersonalGoogleDrivePanel";
import { PersonalBillingAddons } from "./PersonalBillingAddons";
import { PersonalSessionsControl } from "./PersonalSessionsControl";
import {
  PERSONAL_TOUR_DONE_KEY,
  requestProductTour,
} from "@/components/product-tour";
import {
  PERSONAL_ONBOARDING_KEY,
  resetOnboardingDone,
} from "@/components/onboarding/OnboardingStepShell";

const LANGS: LabLang[] = ["en", "fr", "de", "it"];

/** Everything formerly scattered on Overview / header — one quiet Settings screen. */
export function PersonalSettingsPanel() {
  const { lang, setLang } = useLabLanguage();
  const { t } = useLanguage();
  const { surface, openInvite } = usePersonalPlan();
  const { theme, toggleTheme, switchable } = useTheme();
  const ledger = usePersonalBudgetLedger();
  const { entitlements, personalDocumentsUsedThisMonth } = useSubscription();
  const showBusiness = useCanOpenBusinessDashboard();

  const cap = entitlements.maxPersonalDocumentsPerMonth ?? PERSONAL_BASE_DOC_LIMIT;
  const used = Math.max(ledger.totalImportCount, personalDocumentsUsedThisMonth);

  return (
    <div className="space-y-5 max-w-2xl" data-tour="panel-settings">
      <GlassCard className="p-4 space-y-3">
        <p className="text-sm font-semibold">Sessions</p>
        <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
          Organize statement uploads. Current session filters Overview and Budget.
        </p>
        <PersonalSessionsControl />
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <p className="text-sm font-semibold">Language & appearance</p>
        <div className="flex flex-wrap items-center gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`text-xs font-semibold uppercase px-2.5 py-1.5 rounded-lg border transition-colors ${
                lang === l
                  ? "border-[var(--pp-primary)] text-[var(--pp-primary)] bg-[var(--pp-primary)]/5"
                  : "border-[var(--pp-outline-variant)] text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)]"
              }`}
            >
              {l}
            </button>
          ))}
          {switchable && toggleTheme ? (
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 ml-auto px-2.5 py-1.5 rounded-lg border border-[var(--pp-outline-variant)] text-xs font-semibold text-[var(--pp-on-surface-variant)] hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)]"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {theme === "dark" ? t("themeLabelLight") : t("themeLabelDark")}
            </button>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard className="p-4 space-y-2">
        <p className="text-sm font-semibold">Uploads</p>
        <p className="text-xs text-[var(--pp-on-surface-variant)]">
          <span className="font-semibold text-[var(--pp-on-surface)] pp-tabular">
            {used}/{cap}
          </span>{" "}
          documents across all sessions
        </p>
      </GlassCard>

      <PersonalGoogleDrivePanel />

      {surface === "app" ? (
        <GlassCard className="p-4 space-y-3">
          <p className="text-sm font-semibold">Household</p>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
            Invite someone to see your personal Overview, Budget, Reports, and statements.
          </p>
          <button
            type="button"
            onClick={() => openInvite()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--pp-outline-variant)] text-xs font-bold hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)]"
          >
            <UserPlus className="size-4" />
            Invite
          </button>
        </GlassCard>
      ) : null}

      {surface === "app" ? (
        <GlassCard className="p-4 space-y-3">
          <p className="text-sm font-semibold">Help</p>
          <button
            type="button"
            onClick={() => requestProductTour(PERSONAL_TOUR_DONE_KEY, "short")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--pp-outline-variant)] text-xs font-bold hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)]"
          >
            Restart short tour
          </button>
          <button
            type="button"
            onClick={() => requestProductTour(PERSONAL_TOUR_DONE_KEY, "long")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--pp-outline-variant)] text-xs font-bold hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)]"
          >
            Restart long tour
          </button>
          <button
            type="button"
            onClick={() => {
              resetOnboardingDone(PERSONAL_ONBOARDING_KEY);
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--pp-outline-variant)] text-xs font-bold text-[var(--pp-on-surface-variant)] hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)]"
          >
            Restart onboarding
          </button>
        </GlassCard>
      ) : null}

      {surface === "app" ? <PersonalBillingAddons /> : null}

      {surface === "app" && showBusiness ? (
        <Link
          href={businessAppPath()}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)]"
        >
          <Briefcase className="size-4" />
          Business dashboard
        </Link>
      ) : null}
    </div>
  );
}
