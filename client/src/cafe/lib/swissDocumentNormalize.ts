/**
 * Swiss document normalization for ledger posting and reports.
 * Dates → YYYY-MM-DD, VAT from printed fields, supplier names for aggregation.
 */

/** Parse Swiss / EU / ISO invoice dates into YYYY-MM-DD. Returns null if unknown. */
export function normalizeIsoDate(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();

  // Already ISO date or datetime
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
  }

  // DD.MM.YYYY or DD/MM/YYYY (Swiss / EU)
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // YYYY.MM.DD or YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Prefer document date; never invent "today" when a parseable date exists on related fields.
 * Falls back to today only when nothing usable is found (manual entry).
 */
export function resolveDocumentDate(
  ...candidates: Array<string | undefined | null>
): string {
  for (const c of candidates) {
    const iso = normalizeIsoDate(c);
    if (iso) return iso;
  }
  return new Date().toISOString().slice(0, 10);
}

type VatSource = {
  vatAmount?: number | null;
  vatRate?: number | null;
  netAmount?: number | null;
  totalAmount?: number | null;
  amountInCHF?: number | null;
  swissVatBreakdown?: Array<{ vatAmount?: number | null }> | null;
  swissVatReceiptTotals?: { vatTotal?: number | null } | null;
};

/** Resolve TVA/VAT CHF amount from explicit field, Swiss VAT table, rate×net, or gross − net. */
export function resolveDocumentVatAmount(data: VatSource): number {
  const explicit = Number(data.vatAmount);
  if (Number.isFinite(explicit) && explicit > 0.004) {
    return Math.round(explicit * 100) / 100;
  }

  const receiptVat = Number(data.swissVatReceiptTotals?.vatTotal);
  if (Number.isFinite(receiptVat) && receiptVat > 0.004) {
    return Math.round(receiptVat * 100) / 100;
  }

  const lines = Array.isArray(data.swissVatBreakdown) ? data.swissVatBreakdown : [];
  if (lines.length > 0) {
    const sum = lines.reduce((s, l) => s + (Number(l.vatAmount) || 0), 0);
    if (sum > 0.004) return Math.round(sum * 100) / 100;
  }

  const gross = Number(data.amountInCHF ?? data.totalAmount);
  const net = Number(data.netAmount);
  if (Number.isFinite(gross) && Number.isFinite(net) && gross > net && net >= 0) {
    const derived = gross - net;
    if (derived > 0.004 && derived < gross) return Math.round(derived * 100) / 100;
  }

  const rate = Number(data.vatRate);
  if (Number.isFinite(rate) && rate > 0.004 && rate < 100) {
    if (Number.isFinite(net) && net > 0.004) {
      return Math.round(net * (rate / 100) * 100) / 100;
    }
    if (Number.isFinite(gross) && gross > 0.004) {
      // Gross is typically TTC → TVA = gross × rate / (100 + rate)
      return Math.round(((gross * rate) / (100 + rate)) * 100) / 100;
    }
  }

  return Number.isFinite(explicit) && explicit >= 0 ? Math.round(explicit * 100) / 100 : 0;
}

/** Strip "| REF …" from issuer; keep legal/trade name only. */
export function splitIssuerAndReference(raw: string | undefined | null): {
  issuer: string;
  reference?: string;
} {
  const s = (raw || "").trim();
  if (!s) return { issuer: "" };
  const pipe = s.match(/^(.+?)\s*\|\s*(.+)$/);
  if (pipe) return { issuer: pipe[1].trim(), reference: pipe[2].trim() };
  return { issuer: s };
}

/**
 * Canonical supplier key for Top suppliers / reports.
 * Collapses "TALIGRO", "TALIGRO DEMAUREX & CIE SA | REF …" into one bucket.
 */
export function canonicalizeSupplierName(raw: string | undefined | null, unknownLabel = "Unknown"): string {
  let s = (raw || "").trim();
  if (!s) return unknownLabel;

  // Drop invoice / ref suffixes AI often appends
  s = s.replace(/\s*\|\s*.*$/, "");
  s = s.replace(/\s*[-–—]\s*(ref\.?|n[°o]?|nr\.?|facture|invoice|beleg)\s*[:#]?\s*[\w./-]+$/i, "");
  s = s.replace(/\s+/g, " ").trim();

  // Uppercase for stable matching, then title-ish display later if needed
  const upper = s.toUpperCase();

  // Known Swiss wholesaler aliases → canonical display name
  const ALIASES: Array<{ match: RegExp; name: string }> = [
    { match: /\b(TALIGRO|ALIGRO|DEMAUREX)\b/, name: "TALIGRO DEMAUREX & CIE SA" },
    { match: /\bTRANSGOURMET\b/, name: "TRANSGOURMET" },
    { match: /\bPRODEGA\b/, name: "PRODEGA" },
    { match: /\bMIGROS\b/, name: "MIGROS" },
    { match: /\bCOOP\b/, name: "COOP" },
    { match: /\bSWISSCOM\b/, name: "SWISSCOM" },
    { match: /\bSUNRISE\b/, name: "SUNRISE" },
    { match: /\bPOSTFINANCE\b/, name: "POSTFINANCE" },
  ];
  for (const a of ALIASES) {
    if (a.match.test(upper)) return a.name;
  }

  // Strip common legal suffixes for matching, keep a clean display form
  const stripped = upper
    .replace(/\b(S\.?\s*A\.?|SA|SÀRL|SARL|AG|GMBH|LTD|LLC|INC)\b\.?/g, "")
    .replace(/[&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Use first significant token cluster as key when names are noisy variants
  if (stripped.length >= 3) {
    // Prefer original cleaned casing from stripped tokens
    return stripped
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
  }

  return s || unknownLabel;
}
