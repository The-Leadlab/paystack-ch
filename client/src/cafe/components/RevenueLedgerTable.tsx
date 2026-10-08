import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { Expense, Income, ProcessedDocument } from "../types";
import { buildLedgerRows, type LedgerRow } from "@shared/financialReportAggregates";
import { useChfLocale, useLanguage } from "../context/LanguageContext";
import { localizeLedgerDescription } from "../lib/localizeLedgerCopy";
import {
  formatProductLinesPreview,
  productLinesForLedgerEntry,
  type DocumentProductLine,
} from "../lib/documentProductLines";

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
  /** Linked documents — enables expandable invoice item detail. */
  documents?: ProcessedDocument[];
  /** Open full Verification Center for a linked document. */
  onOpenDocument?: (doc: ProcessedDocument) => void;
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
  documents = [],
  onOpenDocument,
}: RevenueLedgerTableProps) {
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setExpandedId(null);
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
      : t("repLedgerDescDetailed") ||
        t("repLedgerDesc") ||
        "Click a row to see product/service lines from the invoice.";
  const vendorCol = incomeOnly ? t("revColSource") : t("repColVendor");
  const categoryCol = incomeOnly ? t("revColType") : t("repColCategory");

  const linesForRow = (row: LedgerRow): DocumentProductLine[] => {
    if (!documents.length) return [];
    return productLinesForLedgerEntry(documents, row.documentId, {
      amount: Math.abs(row.amount),
      date: row.date,
    });
  };

  const findDoc = (documentId?: string) => {
    if (!documentId) return undefined;
    return documents.find((d) => d.id === documentId || d.persistedDocumentId === documentId);
  };

  const toggleExpand = (row: LedgerRow) => {
    setExpandedId((prev) => (prev === row.id ? null : row.id));
  };

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
            <th className="w-8" aria-hidden />
            <th>{t("repColDate")}</th>
            <th>{vendorCol}</th>
            <th>{categoryCol}</th>
            <th>{t("repColAccount")}</th>
            <th className="text-right">{t("repColAmount")}</th>
            <th className="text-right">{t("repColVat")}</th>
            <th>{t("repColDescription")}</th>
            <th className="text-center">{t("repColItems") || "Items"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center text-cdlp-muted py-6">
                {t("repNoData")}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const lines = linesForRow(row);
              const expanded = expandedId === row.id;
              const preview = formatProductLinesPreview(lines, 3);
              const doc = findDoc(row.documentId);

              return (
                <FragmentRow key={row.id}>
                  <tr
                    className={`cursor-pointer transition-colors hover:bg-cdlp-gold/5 ${
                      expanded ? "bg-cdlp-gold/10" : ""
                    }`}
                    onClick={() => toggleExpand(row)}
                    title={t("repClickForDetails") || "Click for invoice item details"}
                  >
                    <td className="ba-field-value text-cdlp-muted">
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="ba-field-value whitespace-nowrap">{row.date}</td>
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
                    <td className="text-center ba-field-value">
                      {lines.length > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded bg-cdlp-gold/15 text-cdlp-gold font-bold text-[10px]">
                          {lines.length}
                        </span>
                      ) : (
                        <span className="text-cdlp-muted/50">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-cdlp-card/40">
                      <td colSpan={9} className="p-0 border-t border-cdlp-border">
                        <div className="p-3 md:p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-gold">
                                {t("repInvoiceDetail") || "Invoice detail"}
                              </p>
                              {preview ? (
                                <p className="text-[11px] text-cdlp-muted mt-0.5">{preview}</p>
                              ) : null}
                            </div>
                            {doc && onOpenDocument ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDocument(doc);
                                }}
                                className="ba-filter-chip flex items-center gap-1.5"
                              >
                                <FileText className="w-3 h-3" />
                                {t("repOpenVerification") || "Open Verification Center"}
                              </button>
                            ) : null}
                          </div>

                          {lines.length > 0 ? (
                            <div className="border border-cdlp-border rounded overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="bg-cdlp-black/40 text-cdlp-muted uppercase text-[9px] tracking-wider">
                                    <th className="px-2 py-1.5 text-left">{t("repColInvoice") || "Invoice"}</th>
                                    <th className="px-2 py-1.5 text-left">{t("repColDescription")}</th>
                                    <th className="px-2 py-1.5 text-right">{t("repColQty") || "Qty"}</th>
                                    <th className="px-2 py-1.5 text-right">{t("repColUnitPrice") || "Unit"}</th>
                                    <th className="px-2 py-1.5 text-right">{t("repColAmount")}</th>
                                    <th className="px-2 py-1.5 text-center">{t("repColCategory")}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-cdlp-border">
                                  {lines.map((line, idx) => (
                                    <tr key={`${row.id}-line-${idx}`}>
                                      <td className="px-2 py-1.5 text-cdlp-muted whitespace-nowrap">
                                        {line.invoiceLabel}
                                      </td>
                                      <td className="px-2 py-1.5 ba-field-value">{line.description}</td>
                                      <td className="px-2 py-1.5 text-right font-mono">
                                        {line.quantity != null ? line.quantity : "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono">
                                        {line.unitPrice != null
                                          ? line.unitPrice.toLocaleString(chfLocale, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })
                                          : "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-bold text-cdlp-gold">
                                        {line.amount.toLocaleString(chfLocale, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </td>
                                      <td className="px-2 py-1.5 text-center text-cdlp-muted">
                                        {line.category || line.type || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-cdlp-black/30 font-bold">
                                    <td colSpan={4} className="px-2 py-1.5 text-right text-cdlp-muted uppercase text-[9px]">
                                      {t("repLineItemsTotal") || "Items total"}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-cdlp-gold">
                                      {lines
                                        .reduce((s, l) => s + (Number(l.amount) || 0), 0)
                                        .toLocaleString(chfLocale, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-cdlp-muted italic">
                              {t("repNoLineItems") ||
                                "No product lines stored for this invoice. Re-open it in Verification Center to capture items."}
                            </p>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                            <div className="ba-subpanel !p-2">
                              <p className="text-cdlp-muted uppercase mb-0.5">{t("repColVendor")}</p>
                              <p className="font-bold ba-field-value truncate">{row.vendor}</p>
                            </div>
                            <div className="ba-subpanel !p-2">
                              <p className="text-cdlp-muted uppercase mb-0.5">{t("repColAccount")}</p>
                              <p className="font-bold ba-field-value">{row.account}</p>
                            </div>
                            <div className="ba-subpanel !p-2">
                              <p className="text-cdlp-muted uppercase mb-0.5">{t("repColAmount")}</p>
                              <p
                                className={`font-black ${
                                  row.tone === "income" ? "text-emerald-500" : "text-red-400"
                                }`}
                              >
                                {row.amount.toLocaleString(chfLocale, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div className="ba-subpanel !p-2">
                              <p className="text-cdlp-muted uppercase mb-0.5">{t("repColVat")}</p>
                              <p className="font-bold text-blue-400">
                                {row.vat.toLocaleString(chfLocale, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </FragmentRow>
              );
            })
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

/** Avoid React key warnings when returning row + expand row. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
