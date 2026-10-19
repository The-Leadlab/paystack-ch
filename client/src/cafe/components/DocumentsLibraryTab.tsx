import React, { useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Grid3X3,
  List,
  MoreVertical,
  Search,
  Upload,
} from "lucide-react";
import { useDocuments } from "../context/DocumentContext";
import { useChfLocale, useLanguage } from "../context/LanguageContext";
import { useUkUat } from "../context/UkUatContext";
import { moneyLocaleForFiscal } from "../lib/fiscalLocale";
import {
  conjoinedCountForSupplierGroup,
  conjoinedInvoicesLabel,
  documentAmountForSupplierGroup,
  documentDisplayName,
  formatIssuerForDisplay,
  formatMonthYearLabel,
  normalizeEntityKey,
  parseMonthKey,
  supplierGroupKeysForDocument,
} from "../i18n/documentDisplayI18n";
import { hydrateProcessedDocumentLineItems } from "../lib/financialDataFirestorePayload";
import { documentTableDisplayAmount } from "../services/swissPayrollService";
import { evaluateVatReview } from "../lib/vatReview";
import { VerificationHub } from "./DocumentProcessor";
import type { FinancialData, ProcessedDocument } from "../types";
import "../businessApp.css";

type DocFilter = "all" | "suppliers" | "employees" | "pos";
type BrowseMode = "library" | "groups";
type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "amount" | "name";

function fileKind(fileName: string | undefined): "pdf" | "sheet" | "other" {
  const n = (fileName || "").toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(xlsx?|csv)$/.test(n)) return "sheet";
  return "other";
}

function statusTone(
  doc: ProcessedDocument,
  vatNeedsAttention: boolean
): "completed" | "verify" | "error" | "pending" {
  if (doc.status === "error") return "error";
  if (doc.status === "needs_review" || (doc.status === "completed" && vatNeedsAttention)) {
    return "verify";
  }
  if (doc.status === "completed") return "completed";
  return "pending";
}

export function DocumentsLibraryTab({
  selectedDocument: initialSelectedDocument,
  onClearSelection,
  onDocumentUpdated,
  onRequestUpload,
}: {
  selectedDocument?: ProcessedDocument | null;
  onClearSelection?: () => void;
  onDocumentUpdated?: (documentId: string, newData: FinancialData) => Promise<void>;
  onRequestUpload?: () => void;
}) {
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const { currencySuffix, fiscalLocale } = useUkUat();
  const moneyLocale = moneyLocaleForFiscal(fiscalLocale);
  const posReportsLabel = t("docPosReports");
  const { documents, updateDocumentData } = useDocuments();
  const [filter, setFilter] = useState<DocFilter>("all");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("library");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    initialSelectedDocument?.id || null
  );
  const [hydratingDoc, setHydratingDoc] = useState(false);

  React.useEffect(() => {
    if (initialSelectedDocument) {
      setSelectedDocumentId(initialSelectedDocument.id);
      setFilter("all");
      setSelectedEntity(null);
    }
  }, [initialSelectedDocument?.id]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentId) return null;
    return (
      documents.find(
        (d) => d.id === selectedDocumentId || d.persistedDocumentId === selectedDocumentId
      ) ||
      (initialSelectedDocument?.id === selectedDocumentId ? initialSelectedDocument : null)
    );
  }, [documents, selectedDocumentId, initialSelectedDocument]);

  React.useEffect(() => {
    if (!selectedDocument?.data) return;
    let cancelled = false;
    void (async () => {
      setHydratingDoc(true);
      try {
        const hydrated = await hydrateProcessedDocumentLineItems(selectedDocument);
        if (cancelled) return;
        if (
          hydrated !== selectedDocument &&
          hydrated.data &&
          (hydrated.data.lineItems?.length || 0) >
            (selectedDocument.data?.lineItems?.length || 0)
        ) {
          const recordId = selectedDocument.persistedDocumentId || selectedDocument.id;
          await updateDocumentData(recordId, { data: hydrated.data });
        }
      } catch (err) {
        console.warn("Documents Verification Center hydrate failed", err);
      } finally {
        if (!cancelled) setHydratingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentId]);

  const groupedDocs = useMemo(() => {
    const suppliers: Record<string, ProcessedDocument[]> = {};
    const employees: Record<string, ProcessedDocument[]> = {};
    const posReports: ProcessedDocument[] = [];
    const other: ProcessedDocument[] = [];

    documents.forEach((doc) => {
      if (!doc.data) {
        other.push(doc);
        return;
      }
      const docType = doc.data.documentType;
      if (docType === "Pay Slip") {
        const employeeName = doc.data.paySlip?.employee?.name || t("docUnknownEmployee");
        if (!employees[employeeName]) employees[employeeName] = [];
        employees[employeeName].push(doc);
      } else if (
        docType === "Ticket/Receipt" ||
        docType === "Z2 Multi-Ticket Sheet" ||
        docType === "Bank Deposit"
      ) {
        posReports.push(doc);
      } else {
        const keys = supplierGroupKeysForDocument(doc);
        for (const key of keys) {
          const supplierName = normalizeEntityKey(key) || "Unknown Supplier";
          if (!suppliers[supplierName]) suppliers[supplierName] = [];
          if (!suppliers[supplierName].some((d) => d.id === doc.id)) {
            suppliers[supplierName].push(doc);
          }
        }
      }
    });

    return { suppliers, employees, posReports, other };
  }, [documents, t]);

  const otherDocsLabel = t("docOtherDocuments") || "Other documents";

  const filteredEntities = useMemo((): Array<[string, ProcessedDocument[]]> => {
    if (filter === "suppliers") return Object.entries(groupedDocs.suppliers);
    if (filter === "employees") return Object.entries(groupedDocs.employees);
    if (filter === "pos") return [[posReportsLabel, groupedDocs.posReports]];
    return [
      ...Object.entries(groupedDocs.suppliers),
      ...Object.entries(groupedDocs.employees),
      ...(groupedDocs.posReports.length > 0
        ? ([[posReportsLabel, groupedDocs.posReports]] as Array<[string, ProcessedDocument[]]>)
        : []),
      ...(groupedDocs.other.length > 0
        ? ([[otherDocsLabel, groupedDocs.other]] as Array<[string, ProcessedDocument[]]>)
        : []),
    ];
  }, [filter, groupedDocs, posReportsLabel, otherDocsLabel]);

  const resolveEntityDocs = (entityName: string): ProcessedDocument[] => {
    if (entityName === posReportsLabel || filter === "pos") return groupedDocs.posReports;
    if (entityName === otherDocsLabel) return groupedDocs.other;
    if (filter === "employees") return groupedDocs.employees[entityName] || [];
    if (filter === "suppliers") return groupedDocs.suppliers[entityName] || [];
    return (
      groupedDocs.suppliers[entityName] ||
      groupedDocs.employees[entityName] ||
      (entityName === posReportsLabel ? groupedDocs.posReports : undefined) ||
      []
    );
  };

  const entityKind = (entityName: string): "supplier" | "employee" | "pos" | "other" => {
    if (entityName === posReportsLabel || filter === "pos") return "pos";
    if (entityName === otherDocsLabel) return "other";
    if (filter === "employees" || groupedDocs.employees[entityName]) return "employee";
    return "supplier";
  };

  const libraryDocs = useMemo(() => {
    let pool: ProcessedDocument[] = [];
    if (filter === "suppliers") {
      pool = Object.values(groupedDocs.suppliers).flat();
    } else if (filter === "employees") {
      pool = Object.values(groupedDocs.employees).flat();
    } else if (filter === "pos") {
      pool = groupedDocs.posReports;
    } else {
      const seen = new Set<string>();
      for (const d of documents) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        pool.push(d);
      }
    }

    const q = search.trim().toLowerCase();
    if (q) {
      pool = pool.filter((d) => {
        const hay = [
          d.fileName,
          d.data?.issuer,
          d.data?.documentType,
          d.data?.date,
          d.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = [...pool];
    sorted.sort((a, b) => {
      if (sortMode === "name") {
        return (a.fileName || "").localeCompare(b.fileName || "");
      }
      if (sortMode === "amount") {
        const aa = a.data ? documentTableDisplayAmount(a.data) : 0;
        const bb = b.data ? documentTableDisplayAmount(b.data) : 0;
        return bb - aa;
      }
      const da = a.data?.date || a.created_at || "";
      const db = b.data?.date || b.created_at || "";
      const cmp = String(db).localeCompare(String(da));
      return sortMode === "oldest" ? -cmp : cmp;
    });
    return sorted;
  }, [documents, filter, groupedDocs, search, sortMode]);

  React.useEffect(() => {
    setPage(1);
  }, [filter, search, sortMode, browseMode, viewMode]);

  const pageCount = Math.max(1, Math.ceil(libraryDocs.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return libraryDocs.slice(start, start + perPage);
  }, [libraryDocs, perPage, safePage]);

  const formatDocDate = (raw: string | undefined) => {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    try {
      return new Intl.DateTimeFormat(chfLocale || moneyLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return raw;
    }
  };

  const groupByMonth = (docs: ProcessedDocument[]) => {
    const byMonth: Record<string, ProcessedDocument[]> = {};
    docs.forEach((doc) => {
      const monthKey = parseMonthKey(doc.data?.date) || "undated";
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(doc);
    });
    return Object.entries(byMonth).sort((a, b) => {
      if (a[0] === "undated") return 1;
      if (b[0] === "undated") return -1;
      return b[0].localeCompare(a[0]);
    });
  };

  const openDocument = (doc: ProcessedDocument) => setSelectedDocumentId(doc.id);
  const closeDocument = () => {
    setSelectedDocumentId(null);
    onClearSelection?.();
  };

  const fmtAmount = (n: number) =>
    `${n.toLocaleString(moneyLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencySuffix}`;

  const statusLabel = (doc: ProcessedDocument, vatNeedsAttention: boolean) => {
    const tone = statusTone(doc, vatNeedsAttention);
    if (tone === "verify") return t("dpStatusNeedAction");
    if (tone === "completed") return t("dpStatusCompleted") || t("docStatusCompleted") || "Completed";
    if (tone === "error") return t("dpStatusError") || "Error";
    if (doc.status === "processing") return t("dpStatusProcessing") || "Processing";
    if (doc.status === "skipped") return t("dpStatusSkipped") || "Skipped";
    return t("dpStatusPending") || "Pending";
  };

  const renderDocCard = (doc: ProcessedDocument, opts?: { amountOverride?: number }) => {
    const vatReview = evaluateVatReview(doc.data);
    const vatNeedsAttention = doc.status === "needs_review" || vatReview.needsAction;
    const tone = statusTone(doc, vatNeedsAttention);
    const kind = fileKind(doc.fileName);
    const amount =
      opts?.amountOverride ??
      (doc.data ? documentTableDisplayAmount(doc.data) : null);
    const issuer = doc.data?.issuer
      ? formatIssuerForDisplay(doc.data.issuer, t, { fileName: doc.fileName })
      : t("docUnknownSupplier") || "—";
    const typeLabel = doc.data?.documentType || t("docType") || "Document";
    const actionable = doc.status === "completed" || doc.status === "needs_review";
    const lines =
      doc.lineItemsCount ||
      doc.data?.lineItems?.length ||
      0;
    const linesLabel =
      lines > 0
        ? (t("docLinesCount") || "{n} lines").replace("{n}", String(lines))
        : null;

    return (
      <article
        key={doc.id}
        className={`ba-doc-card ${viewMode === "list" ? "ba-doc-card--list" : ""}`}
      >
        <div className="ba-doc-card__top">
          <span className={`ba-doc-file-icon ba-doc-file-icon--${kind}`} aria-hidden>
            {kind === "sheet" ? (
              <FileSpreadsheet className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </span>
          <button
            type="button"
            className="ba-doc-card__menu"
            title={t("dpColActions")}
            onClick={(e) => {
              e.stopPropagation();
              if (actionable) openDocument(doc);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <button type="button" className="ba-doc-card__body" onClick={() => openDocument(doc)}>
          <h3 className="ba-doc-card__title" title={doc.fileName}>
            {documentDisplayName(doc.fileName, doc.fileName || "Document")}
          </h3>
          <p className="ba-doc-card__issuer">{issuer}</p>
          <ul className="ba-doc-card__meta">
            <li>
              <Calendar className="w-3 h-3 shrink-0" aria-hidden />
              <span>{formatDocDate(doc.data?.date || doc.created_at)}</span>
            </li>
            <li>
              <span className="ba-doc-card__dot" aria-hidden />
              <span>{typeLabel}</span>
            </li>
            {linesLabel ? (
              <li>
                <span className="ba-doc-card__dot" aria-hidden />
                <span>{linesLabel}</span>
              </li>
            ) : null}
          </ul>
        </button>

        <div className="ba-doc-card__foot">
          <span className="ba-doc-card__amount">
            {(() => {
              const cur = String(doc.data?.originalCurrency || "CHF")
                .trim()
                .toUpperCase();
              const foreign =
                fiscalLocale !== "uk" &&
                cur &&
                cur !== "CHF" &&
                cur !== "---" &&
                Number(doc.data?.conversionRateUsed || 1) !== 1;
              const orig = Number(doc.data?.totalAmount ?? 0);
              if (foreign && amount != null) {
                return (
                  <>
                    <span className="ba-doc-card__amount-chf">{fmtAmount(amount)}</span>
                    <span className="ba-doc-card__amount-fx">
                      {orig.toLocaleString(moneyLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {cur}
                    </span>
                  </>
                );
              }
              return amount != null ? fmtAmount(amount) : `—${currencySuffix}`;
            })()}
          </span>
          <span className={`ba-status-pill ba-status-pill--${tone}`}>
            {statusLabel(doc, vatNeedsAttention)}
          </span>
          <button
            type="button"
            className="ba-doc-card__verify"
            onClick={() => openDocument(doc)}
          >
            {t("dpVerify")}
          </button>
        </div>
      </article>
    );
  };

  if (selectedDocument) {
    const recordId = selectedDocument.persistedDocumentId || selectedDocument.id;
    return (
      <div className="space-y-4">
        <div className="ba-page-header flex-col items-start !mb-2">
          <button
            type="button"
            onClick={closeDocument}
            className="flex items-center gap-2 text-cdlp-gold hover:text-cdlp-gold-light text-sm font-bold uppercase mb-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> {t("docBackToDocuments")}
          </button>
          {hydratingDoc ? (
            <p className="text-[10px] text-cdlp-muted uppercase tracking-wider">
              {t("docLoadingDetails") || "Loading full line items…"}
            </p>
          ) : null}
        </div>
        {selectedDocument.data ? (
          <VerificationHub
            doc={selectedDocument}
            onUpdate={(newData) => {
              void updateDocumentData(recordId, { data: newData });
            }}
            onSave={async (newData) => {
              const confirmed = {
                ...newData,
                vatConfirmed: true,
                isHumanVerified: true,
              };
              await updateDocumentData(recordId, {
                status: "completed",
                data: confirmed,
              });
              if (onDocumentUpdated) {
                await onDocumentUpdated(recordId, confirmed);
              }
              closeDocument();
            }}
          />
        ) : (
          <div className="ba-panel text-center py-12">
            <FileText className="w-12 h-12 text-cdlp-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-cdlp-muted">{t("docFileNotAvailable")}</p>
          </div>
        )}
      </div>
    );
  }

  if (selectedEntity) {
    const entityDocs = resolveEntityDocs(selectedEntity);
    const kind = entityKind(selectedEntity);
    const monthlyGroups = groupByMonth(entityDocs || []);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setSelectedEntity(null)}
            className="flex items-center gap-2 text-cdlp-gold hover:text-cdlp-gold-light text-sm font-bold uppercase shrink-0"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> {t("docBack")}
          </button>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase truncate">
              {(() => {
                if (kind === "pos") return posReportsLabel;
                if (kind === "other") return otherDocsLabel;
                const count = conjoinedCountForSupplierGroup(entityDocs || [], selectedEntity);
                if (count > 1) {
                  return documentDisplayName(
                    entityDocs?.[0]?.fileName,
                    t("dpMultiInvoiceDocument")
                  );
                }
                return formatIssuerForDisplay(selectedEntity, t, {
                  fileName: entityDocs?.[0]?.fileName,
                });
              })()}
            </h2>
            {(() => {
              const count = conjoinedCountForSupplierGroup(entityDocs || [], selectedEntity);
              return count > 1 ? (
                <p className="text-xs text-cdlp-muted">{conjoinedInvoicesLabel(count, t)}</p>
              ) : null;
            })()}
          </div>
        </div>

        {monthlyGroups.length === 0 ? (
          <div className="ba-panel p-12 text-center">
            <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">{t("docNoDocuments")}</h3>
            <p className="text-cdlp-muted text-sm">{t("docNoDocumentsEntity")}</p>
          </div>
        ) : (
          monthlyGroups.map(([month, docs]) => {
            const totalAmount = docs.reduce(
              (sum, d) => sum + documentAmountForSupplierGroup(d, selectedEntity),
              0
            );
            const monthName =
              month === "undated"
                ? t("docUndated")
                : formatMonthYearLabel(month, chfLocale, t("repInvalidMonth"));

            return (
              <div key={month} className="space-y-3">
                <div className="ba-doc-month-bar">
                  <h3 className="ba-doc-month-bar__title">{monthName}</h3>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-cdlp-muted">
                      {t("docTotalChf")}
                    </p>
                    <p className="text-base font-black ba-field-value">{fmtAmount(totalAmount)}</p>
                  </div>
                </div>
                <div className={viewMode === "list" ? "ba-doc-library ba-doc-library--list" : "ba-doc-library"}>
                  {docs.map((doc) =>
                    renderDocCard(doc, {
                      amountOverride: documentAmountForSupplierGroup(doc, selectedEntity),
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="ba-doc-library-page space-y-5">
      <div className="ba-page-header ba-doc-library-header">
        <div className="min-w-0">
          <h1>{t("documents")}</h1>
          <p className="ba-page-subtitle">{t("documentsLibrarySubtitle")}</p>
        </div>
        <div className="ba-doc-library-actions">
          <button
            type="button"
            className="ba-btn-ghost"
            onClick={() => onRequestUpload?.()}
          >
            <Upload className="w-3.5 h-3.5" />
            {t("docUploadDocument")}
          </button>
          <button
            type="button"
            className="ba-btn-primary-blue"
            onClick={() => setBrowseMode((m) => (m === "library" ? "groups" : "library"))}
          >
            {browseMode === "library" ? t("docBrowseByGroup") : t("docBrowseLibrary")}
          </button>
        </div>
      </div>

      <div className="ba-doc-toolbar">
        <label className="ba-doc-search">
          <Search className="w-4 h-4 shrink-0 opacity-60" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("docSearchPlaceholder")}
            className="ba-doc-search__input"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`ba-filter-chip ${filter === "all" ? "ba-filter-chip--active" : ""}`}
          >
            {t("docAllDocuments")}
          </button>
          <button
            type="button"
            onClick={() => setFilter("suppliers")}
            className={`ba-filter-chip ${filter === "suppliers" ? "ba-filter-chip--active" : ""}`}
          >
            {t("docSuppliersCount").replace(
              "{n}",
              String(Object.keys(groupedDocs.suppliers).length)
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("employees")}
            className={`ba-filter-chip ${filter === "employees" ? "ba-filter-chip--active" : ""}`}
          >
            {t("docEmployeesCount").replace(
              "{n}",
              String(Object.keys(groupedDocs.employees).length)
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("pos")}
            className={`ba-filter-chip ${filter === "pos" ? "ba-filter-chip--active" : ""}`}
          >
            {t("docPosCount").replace("{n}", String(groupedDocs.posReports.length))}
          </button>
        </div>

        <div className="ba-doc-toolbar__meta">
          <div className="ba-doc-view-toggle" role="group" aria-label={t("docViewToggle")}>
            <button
              type="button"
              className={viewMode === "grid" ? "is-active" : ""}
              onClick={() => setViewMode("grid")}
              title={t("docViewGrid")}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className={viewMode === "list" ? "is-active" : ""}
              onClick={() => setViewMode("list")}
              title={t("docViewList")}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <select
            className="ba-doc-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label={t("docSortBy")}
          >
            <option value="newest">{t("docSortNewest")}</option>
            <option value="oldest">{t("docSortOldest")}</option>
            <option value="amount">{t("docSortAmount")}</option>
            <option value="name">{t("docSortName")}</option>
          </select>
        </div>
      </div>

      {browseMode === "library" ? (
        libraryDocs.length === 0 ? (
          <div className="ba-panel p-12 text-center">
            <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">
              {t("docNoDocumentsYet")}
            </h3>
            <p className="text-cdlp-muted text-sm mb-4">{t("docNoDocumentsYetHint")}</p>
            <button type="button" className="ba-btn-primary-blue" onClick={() => onRequestUpload?.()}>
              <Upload className="w-3.5 h-3.5" />
              {t("docUploadDocument")}
            </button>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === "list" ? "ba-doc-library ba-doc-library--list" : "ba-doc-library"
              }
            >
              {pageSlice.map((doc) => renderDocCard(doc))}
            </div>
            <div className="ba-doc-pager">
              <p className="ba-doc-count">
                {t("docShowingRange")
                  .replace(
                    "{from}",
                    String(libraryDocs.length === 0 ? 0 : (safePage - 1) * perPage + 1)
                  )
                  .replace(
                    "{to}",
                    String(Math.min(safePage * perPage, libraryDocs.length))
                  )
                  .replace("{total}", String(libraryDocs.length))}
              </p>
              <div className="ba-doc-pager__pages" role="navigation" aria-label={t("docPagination")}>
                <button
                  type="button"
                  className="ba-doc-pager__btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(pageCount, 6) }, (_, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`ba-doc-pager__btn ${safePage === n ? "is-active" : ""}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  );
                })}
                {pageCount > 6 ? (
                  <>
                    <span className="ba-doc-pager__ellipsis">…</span>
                    <button
                      type="button"
                      className={`ba-doc-pager__btn ${safePage === pageCount ? "is-active" : ""}`}
                      onClick={() => setPage(pageCount)}
                    >
                      {pageCount}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="ba-doc-pager__btn"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  ›
                </button>
              </div>
              <label className="ba-doc-pager__per">
                <select
                  className="ba-doc-sort"
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label={t("docPerPage")}
                >
                  <option value={12}>{t("docPerPageN").replace("{n}", "12")}</option>
                  <option value={24}>{t("docPerPageN").replace("{n}", "24")}</option>
                  <option value={48}>{t("docPerPageN").replace("{n}", "48")}</option>
                </select>
              </label>
            </div>
          </>
        )
      ) : filteredEntities.length === 0 ? (
        <div className="ba-panel p-12 text-center">
          <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">
            {t("docNoDocumentsYet")}
          </h3>
          <p className="text-cdlp-muted text-sm mb-4">{t("docNoDocumentsYetHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map(([entityName, docs]) => {
            const totalAmount = docs.reduce(
              (sum, d) => sum + documentAmountForSupplierGroup(d, entityName),
              0
            );
            const docCount = docs.length;
            const kind = entityKind(entityName);
            const conjoinedCount = conjoinedCountForSupplierGroup(docs, entityName);
            const primaryTitle =
              kind === "pos"
                ? docCount === 1
                  ? documentDisplayName(docs[0]?.fileName, posReportsLabel)
                  : posReportsLabel
                : kind === "other"
                  ? otherDocsLabel
                  : conjoinedCount > 1
                    ? documentDisplayName(docs[0]?.fileName, t("dpMultiInvoiceDocument"))
                    : formatIssuerForDisplay(entityName, t, { fileName: docs[0]?.fileName });
            const kindLabel =
              kind === "employee"
                ? t("docEntityEmployee")
                : kind === "pos"
                  ? t("docPosReports")
                  : kind === "other"
                    ? otherDocsLabel
                    : t("docEntitySupplier");

            return (
              <button
                type="button"
                key={entityName}
                onClick={() => {
                  if (docs.length === 1) {
                    openDocument(docs[0]);
                    return;
                  }
                  setSelectedEntity(entityName);
                }}
                className="ba-entity-card group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base mb-1 truncate">{primaryTitle}</h3>
                    {conjoinedCount > 1 ? (
                      <p className="text-xs text-cdlp-muted mb-1">
                        {conjoinedInvoicesLabel(conjoinedCount, t)}
                      </p>
                    ) : null}
                    <p className="text-xs text-cdlp-muted uppercase">{kindLabel}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-cdlp-muted group-hover:text-cdlp-gold transition-colors" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cdlp-muted uppercase">{t("documents")}</span>
                    <span className="text-sm font-bold ba-field-value">{docCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cdlp-muted uppercase">{t("docTotalAmount")}</span>
                    <span className="text-lg font-black text-cdlp-gold">
                      {fmtAmount(totalAmount)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
