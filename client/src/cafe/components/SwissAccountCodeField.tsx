import { useMemo, useState } from "react";
import {
  formatSwissAccountRef,
  getSwissAccount,
  searchSwissAccounts,
  type SwissAccountLang,
} from "@shared/swissChartOfAccounts";
import { suggestSwissAccountCode } from "@shared/suggestSwissAccountCode";

type Props = {
  value: string;
  onChange: (konto: string) => void;
  lang: SwissAccountLang;
  kind: "income" | "expense";
  category?: string;
  incomeType?: string;
  description?: string;
  placeholder?: string;
  className?: string;
};

export function SwissAccountCodeField({
  value,
  onChange,
  lang,
  kind,
  category,
  incomeType,
  description,
  placeholder,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  const suggested = useMemo(
    () =>
      suggestSwissAccountCode({
        kind,
        category,
        incomeType,
        description,
      }),
    [kind, category, incomeType, description]
  );

  const results = useMemo(
    () => searchSwissAccounts(query || value, lang, 10),
    [query, value, lang]
  );

  const pick = (konto: string) => {
    onChange(konto);
    setQuery(konto);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || "1020"}
          className="w-20 px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white font-mono"
        />
        {suggested && suggested !== value && (
          <button
            type="button"
            className="px-2 py-1 text-[9px] font-bold uppercase rounded border border-cdlp-gold/40 text-cdlp-gold hover:bg-cdlp-gold/10"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(suggested)}
            title={formatSwissAccountRef(suggested, lang)}
          >
            {suggested}
          </button>
        )}
      </div>
      {value && getSwissAccount(value) && (
        <p className="text-[9px] text-cdlp-muted mt-0.5 truncate">{formatSwissAccountRef(value, lang)}</p>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full min-w-[240px] max-h-40 overflow-y-auto bg-cdlp-card border border-cdlp-border rounded shadow-lg text-[10px]">
          {results.map((a) => (
            <li key={a.konto}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-cdlp-gold/10 text-white"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a.konto)}
              >
                <span className="font-mono font-bold text-cdlp-gold">{a.konto}</span>{" "}
                <span className="text-cdlp-muted">{lang === "fr" ? a.labelFr : a.labelEn}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SwissAccountCodeBadge({
  konto,
  lang,
}: {
  konto?: string | null;
  lang: SwissAccountLang;
}) {
  if (!konto) return null;
  const entry = getSwissAccount(konto);
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cdlp-gold/10 border border-cdlp-gold/30 text-[9px] font-mono text-cdlp-gold"
      title={entry ? (lang === "fr" ? entry.labelFr : entry.labelEn) : konto}
    >
      {konto}
    </span>
  );
}
