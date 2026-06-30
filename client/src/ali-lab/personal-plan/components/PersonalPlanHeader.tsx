import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import type { LabLang } from "../../i18n/labStrings";

const LANGS: LabLang[] = ["en", "fr", "de", "it"];

export function PersonalPlanHeader({ title }: { title?: string }) {
  const { lang, setLang } = useLabLanguage();
  const { month, setMonth } = usePersonalPlan();
  const ledger = useLinkedLedger(month);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === "fr" ? "fr-CH" : "de-CH", {
      month: "long",
      year: "numeric",
    });
  }, [month, lang]);

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center h-16 px-4 md:px-16 bg-[var(--pp-surface)] border-b border-[var(--pp-outline-variant)]">
      <div className="flex items-center gap-4 md:gap-6 min-w-0">
        {title ? (
          <h2 className="text-base md:text-lg font-semibold text-[var(--pp-primary)] truncate">{title}</h2>
        ) : null}
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-[var(--pp-on-surface-variant)]">
            Month{" "}
            <input
              type="month"
              className="pp-input px-2 py-1 text-xs font-bold text-[var(--pp-primary)] border-b-2 border-[var(--pp-primary)] bg-transparent rounded-none ml-1"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <span className="hidden md:inline text-sm text-[var(--pp-on-surface-variant)]">{monthLabel}</span>
          <div className="flex gap-1">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded transition-colors ${
                  lang === l
                    ? "text-[var(--pp-primary)] border-b border-[var(--pp-primary)]"
                    : "text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-on-surface)]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          className="p-2 rounded-full hover:bg-[var(--pp-surface-high)] transition-colors text-[var(--pp-on-surface-variant)]"
          onClick={() => void ledger.refreshFinances()}
          disabled={ledger.loading}
          aria-label="Refresh ledger"
        >
          <RefreshCw className={`size-4 ${ledger.loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </header>
  );
}
