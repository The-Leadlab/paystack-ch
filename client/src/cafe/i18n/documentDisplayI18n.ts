import { canonicalizeSupplierName } from "../lib/swissDocumentNormalize";

const INVOICES_DETECTED_RE = /^(\d+)\s+invoices detected$/i;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** Parse stored "N invoices detected" issuer labels. */
export function parseInvoicesDetectedCount(issuer: string | undefined): number | null {
  if (!issuer) return null;
  const m = issuer.match(INVOICES_DETECTED_RE);
  return m ? Number(m[1]) : null;
}

/** Strip extension for a readable document title. */
export function documentDisplayName(fileName: string | undefined, fallback = ""): string {
  if (!fileName?.trim()) return fallback;
  return fileName.replace(/\.[^.]+$/, "").trim() || fileName.trim();
}

/**
 * Normalize supplier/employee names for stable Documents-tab grouping.
 * Uses the same canonicalization as reports so "Supplier - Facture 12" collapses.
 */
export function normalizeEntityKey(name: string | undefined): string {
  const cleaned = (name || "")
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*.*$/, "")
    .trim();
  if (!cleaned) return "";
  if (parseInvoicesDetectedCount(cleaned) != null) return "";
  const canonical = canonicalizeSupplierName(cleaned, "");
  const base = canonical || cleaned;
  // Fold accents so "Bar à tapas" and "Bar a tapas" share one card.
  return base.normalize("NFD").replace(/\p{M}/gu, "");
}

type SubDocLike = {
  issuer?: string;
  totalAmount?: number;
  amountInCHF?: number;
};

type DocLike = {
  id?: string;
  fileName?: string;
  data?: {
    issuer?: string;
    totalAmount?: number;
    amountInCHF?: number;
    subDocuments?: SubDocLike[];
  };
};

/**
 * Supplier keys for Documents tab grouping.
 *
 * Multi-invoice PDFs:
 * - Same supplier (after canonicalize) → ONE card for the whole binder.
 * - Truly different suppliers → one card per distinct supplier (fan-out).
 * Never collapse under the AI label "N invoices detected".
 */
export function supplierGroupKeysForDocument(doc: DocLike): string[] {
  const subs = Array.isArray(doc.data?.subDocuments) ? doc.data!.subDocuments! : [];
  const subIssuers = subs
    .map((s) => normalizeEntityKey(s.issuer))
    .filter((name) => Boolean(name));

  const uniqueSubs = Array.from(new Set(subIssuers.map((n) => n.toLowerCase()))).map((lower) => {
    return subIssuers.find((n) => n.toLowerCase() === lower) || lower;
  });

  if (uniqueSubs.length === 1) return [uniqueSubs[0]];
  if (uniqueSubs.length > 1) return uniqueSubs;

  const top = normalizeEntityKey(doc.data?.issuer);
  if (top) return [top];
  return ["Unknown Supplier"];
}

/** Sub-invoices on a document that belong to a given supplier group key. */
export function matchingSubDocumentsForSupplier(
  doc: DocLike,
  supplierKey: string
): SubDocLike[] {
  const key = normalizeEntityKey(supplierKey).toLowerCase();
  const subs = Array.isArray(doc.data?.subDocuments) ? doc.data!.subDocuments! : [];
  if (!key || subs.length === 0) return subs;
  return subs.filter((s) => normalizeEntityKey(s.issuer).toLowerCase() === key);
}

/**
 * Amount shown on a supplier entity card for one document.
 * Mixed binders: only sum sub-invoices for that supplier (avoids N× total on fan-out).
 * Single-supplier binders: full document total.
 */
export function documentAmountForSupplierGroup(doc: DocLike, supplierKey: string): number {
  const subs = Array.isArray(doc.data?.subDocuments) ? doc.data!.subDocuments! : [];
  const full =
    Number(doc.data?.amountInCHF || 0) || Number(doc.data?.totalAmount || 0) || 0;

  if (subs.length === 0) return full;

  const uniqueKeys = supplierGroupKeysForDocument(doc);
  if (uniqueKeys.length <= 1) return full;

  const matching = matchingSubDocumentsForSupplier(doc, supplierKey);
  if (matching.length === 0) return full;
  return matching.reduce(
    (sum, s) => sum + (Number(s.amountInCHF || 0) || Number(s.totalAmount || 0) || 0),
    0
  );
}

/** Invoice count for card subtitle under a supplier key. */
export function conjoinedCountForSupplierGroup(docs: DocLike[], supplierKey: string): number {
  let max = 0;
  for (const doc of docs) {
    const detected = parseInvoicesDetectedCount(doc.data?.issuer);
    const subs = Array.isArray(doc.data?.subDocuments) ? doc.data!.subDocuments! : [];
    const uniqueKeys = supplierGroupKeysForDocument(doc);
    if (uniqueKeys.length <= 1) {
      max = Math.max(max, detected ?? subs.length, 1);
      continue;
    }
    const matching = matchingSubDocumentsForSupplier(doc, supplierKey);
    max = Math.max(max, matching.length || 1);
  }
  return max;
}

/**
 * Primary label for entity cards / headers.
 * Multi-invoice PDFs used to show "N invoices detected" — prefer the file name instead
 * only when we do not have a real supplier key.
 */
export function formatIssuerForDisplay(
  issuer: string | undefined,
  t: (key: string) => string,
  opts?: { fileName?: string }
): string {
  if (!issuer) return opts?.fileName ? documentDisplayName(opts.fileName) : "";
  const count = parseInvoicesDetectedCount(issuer);
  if (count != null) {
    if (opts?.fileName) return documentDisplayName(opts.fileName);
    return t("dpMultiInvoiceDocument");
  }
  return issuer;
}

/** Small subtitle: "2 conjoined invoices". */
export function conjoinedInvoicesLabel(count: number, t: (key: string) => string): string {
  return t("dpConjoinedInvoices").replace("{n}", String(count));
}

export function invoicesDetectedIssuer(count: number, t: (key: string) => string): string {
  return conjoinedInvoicesLabel(count, t);
}

export const UNDATED_MONTH_KEY = "undated";

/**
 * Normalize common Gemini / Swiss date strings to a YYYY-MM month key.
 * Accepts ISO (YYYY-MM-DD), Swiss (DD.MM.YYYY), and slash forms.
 */
export function parseMonthKey(dateStr: string | undefined): string | null {
  if (!dateStr?.trim()) return null;
  const raw = dateStr.trim();

  if (raw.length >= 7) {
    const isoPrefix = raw.substring(0, 7);
    if (MONTH_KEY_RE.test(isoPrefix) && /^\d{4}-\d{2}/.test(raw)) return isoPrefix;
  }

  const swiss = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (swiss) {
    const month = Number(swiss[2]);
    const year = Number(swiss[3]);
    if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  const ymdSlash = raw.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (ymdSlash) {
    const year = Number(ymdSlash[1]);
    const month = Number(ymdSlash[2]);
    if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  return null;
}

export function formatMonthYearLabel(
  month: string,
  locale: string,
  invalidLabel: string
): string {
  if (!MONTH_KEY_RE.test(month)) return invalidLabel;
  const d = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return invalidLabel;
  return d.toLocaleDateString(locale, { year: "numeric", month: "long" });
}
