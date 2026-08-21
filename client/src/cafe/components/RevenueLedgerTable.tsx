import { useEffect, useState } from "react";
import type { Expense, Income } from "../types";
import { buildLedgerRows } from "@shared/financialReportAggregates";
import { useChfLocale, useLanguage } from "../context/LanguageContext";
import { localizeLedgerDescription } from "../lib/localizeLedgerCopy";

const PAGE_SIZE = 10;

type RevenueLedgerTableProps = {
  income: Income[];
  expenses: Expense[];
  /** When true, only income rows (Revenue tab breakdown). Reports keep full ledger. */
  incomeOnly?: boolean;
  /** When true, only expense rows (Expenses hub). */
  expensesOnly?: boolean;
  showToggle?: boolean;
  enabled?: boolean;
  onToggle?: () => void;
  toggleBusy?: boolean;
};

export function RevenueLedgerTable({
  income,
  expenses,
  incomeOnly = false,
  expensesOnly = false,
  showToggle = false,
  enabled = false,
  onToggle,
  toggleBusy = false,
}: RevenueLedgerTableProps) {
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categoryLabel = (cat: string) => {
    const known = [
      "SALES",
      "RESERVATION",
      "BILLS",
      "SUPPLIERS",
      "PAYROLL",
      "PAYROLL_TAXES",
      "OTHER",
    ] as const;
    if ((known as readonly string[]).includes(cat)) return t(cat);
    return cat;
  };

  const allRows = buildLedgerRows(
    expensesOnly ? [] : income,
    incomeOnly ? [] : expenses,
    categoryLabel,
    (type) => (type === "SALES" || type === "RESERVATION" ? t(type) : type)
  );

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [income.length, expenses.length, incomeOnly, expensesOnly]);

  const rows = allRows.slice(0, visible);
  const remaining = Math.max(0, allRows.length - visible);

  const title = expensesOnly
    ? t("ehBreakdownTitle")
    : incomeOnly
      ? t("revBreakdownTitle")
      : t("repLedgerTitle");
  const desc = expensesOnly
    ? t("ehBreakdownDesc")
    : incomeOnly
      ? t("revBreakdownDesc")
      : t("repLedgerDesc");
  const vendorCol = incomeOnly ? t("revColSource") : t("repColVendor");
  const categoryCol = incomeOnly ? t("revColType") : t("repColCategory");

  return (
    <div className="ba-panel overflow-x-auto">
      <div className="ba-section-head flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2>{title}</h2>
        </div>
        {showToggle && onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={toggleBusy}
            className={`ba-filter-chip ${enabled ? "ba-filter-chip--active" : ""}`}
          >
            {enabled ? t("repLedgerOnRevenue") : t("repLedgerOffRevenue")}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-cdlp-muted mb-3">{desc}</p>
      <table className="ba-doc-table w-full text-left text-xs">
        <thead>
          <tr>
            <th>{t("repColDate")}</th>
            <th>{vendorCol}</th>
            <th>{categoryCol}</th>
            <th>{t("repColAccount")}</th>
            <th className="text-right">{t("repColAmount")}</th>
            <th className="text-right">{t("repColVat")}</th>
            <th>{t("repColDescription")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center text-cdlp-muted py-6">
                {t("repNoData")}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="ba-field-value">{row.date}</td>
                <td className="truncate max-w-[10rem] ba-field-value">{row.vendor}</td>
                <td className="ba-field-value">{categoryLabel(row.category)}</td>
                <td className="ba-field-value">{row.account}</td>
                <td
                  className={`text-right font-bold ${row.tone === "income" ? "text-emerald-500" : "text-red-400"}`}
                >
                  {row.amount.toLocaleString(chfLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="text-right ba-field-value">
                  {row.vat.toLocaleString(chfLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="truncate max-w-[14rem] ba-field-value">
                  {localizeLedgerDescription(row.description, t)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {allRows.length > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {remaining > 0 ? (
            <button
              type="button"
              className="ba-filter-chip"
              onClick={() => setVisible((n) => Math.min(allRows.length, n + PAGE_SIZE))}
            >
              {t("rhLoadMore").replace("{n}", String(remaining))}
            </button>
          ) : (
            <button type="button" className="ba-filter-chip" onClick={() => setVisible(PAGE_SIZE)}>
              {t("rhShowLess")}
            </button>
          )}
          <span className="text-[10px] text-cdlp-muted uppercase tracking-wide">
            {Math.min(visible, allRows.length)} / {allRows.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
