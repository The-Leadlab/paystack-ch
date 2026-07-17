import type { Expense, Income } from "../types";
import { buildLedgerRows } from "@shared/financialReportAggregates";
import { useChfLocale, useLanguage } from "../context/LanguageContext";

type RevenueLedgerTableProps = {
  income: Income[];
  expenses: Expense[];
  showToggle?: boolean;
  enabled?: boolean;
  onToggle?: () => void;
  toggleBusy?: boolean;
};

export function RevenueLedgerTable({
  income,
  expenses,
  showToggle = false,
  enabled = false,
  onToggle,
  toggleBusy = false,
}: RevenueLedgerTableProps) {
  const { t } = useLanguage();
  const chfLocale = useChfLocale();

  const categoryLabel = (cat: string) => {
    const known = ["BILLS", "SUPPLIERS", "PAYROLL", "PAYROLL_TAXES", "OTHER"] as const;
    if ((known as readonly string[]).includes(cat)) return t(cat);
    return cat;
  };

  const rows = buildLedgerRows(
    income,
    expenses,
    categoryLabel,
    (type) => (type === "SALES" || type === "RESERVATION" ? t(type) : type)
  ).slice(0, 200);

  return (
    <div className="ba-panel overflow-x-auto">
      <div className="ba-section-head flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2>{t("repLedgerTitle")}</h2>
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
      <p className="text-xs text-cdlp-muted mb-3">{t("repLedgerDesc")}</p>
      <table className="ba-doc-table w-full text-left text-xs">
        <thead>
          <tr>
            <th>{t("repColDate")}</th>
            <th>{t("repColVendor")}</th>
            <th>{t("repColCategory")}</th>
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
                <td>{row.date}</td>
                <td className="truncate max-w-[10rem]">{row.vendor}</td>
                <td>{row.category}</td>
                <td>{row.account}</td>
                <td
                  className={`text-right font-bold ${row.tone === "income" ? "text-emerald-500" : "text-red-400"}`}
                >
                  {row.amount.toLocaleString(chfLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="text-right">
                  {row.vat.toLocaleString(chfLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="truncate max-w-[14rem]">{row.description}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
