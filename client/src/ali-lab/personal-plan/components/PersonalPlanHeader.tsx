import { useMemo, useState } from "react";
import { Bell, ChevronDown, RefreshCw, Search } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { useAliLabLedger } from "../../hooks/useAliLabLedger";
import type { LabLang } from "../../i18n/labStrings";

const LANGS: LabLang[] = ["en", "fr", "de", "it"];

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PersonalPlanHeader({ title }: { title?: string }) {
  const { lang, setLang } = useLabLanguage();
  const ledger = useAliLabLedger();
  const [month, setMonth] = useState(monthKey());

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
        ) : (
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--pp-on-surface-variant)]" />
            <input
              type="search"
              className="pp-input rounded-full pl-10 pr-4 py-1.5 text-sm w-48 md:w-64"
              placeholder="Search…"
              disabled
              aria-label="Search"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="pp-input px-2 py-1 text-xs font-bold text-[var(--pp-primary)] border-b-2 border-[var(--pp-primary)] bg-transparent rounded-none"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
          />
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
        <button
          type="button"
          className="p-2 rounded-full hover:bg-[var(--pp-surface-high)] transition-colors text-[var(--pp-on-surface-variant)]"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
        </button>
        <div className="flex items-center gap-1 cursor-pointer group">
          <div className="w-8 h-8 rounded-full border border-[var(--pp-outline-variant)] bg-[var(--pp-surface-highest)] flex items-center justify-center text-xs font-bold text-[var(--pp-primary)]">
            PS
          </div>
          <ChevronDown className="size-4 text-[var(--pp-on-surface-variant)] group-hover:text-[var(--pp-primary)] transition-colors hidden sm:block" />
        </div>
      </div>
    </header>
  );
}
