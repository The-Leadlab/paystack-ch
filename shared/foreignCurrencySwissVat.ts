/**
 * Border restaurants (e.g. Geneva) receive EUR invoices with foreign VAT.
 * For a Swiss-domiciled buyer: keep printed EUR amounts, convert HT/TTC → CHF,
 * put CHF HT on the Swiss table at 0% (EU VAT is NOT Swiss filing VAT), and
 * flag foreign VAT for reconciliation.
 */

export type SwissVatLineLike = {
  ratePercent: number;
  baseExclusive: number;
  vatAmount: number;
};

export type FxSwissVatInput = {
  originalCurrency?: string | null;
  totalAmount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  conversionRateUsed?: number | null;
  amountInCHF?: number | null;
  expenseCategory?: string | null;
  swissVatBreakdown?: SwissVatLineLike[] | null;
  swissVatReceiptTotals?: {
    merchandiseSubtotal?: number | null;
    vatTotal?: number | null;
    deposit?: number | null;
    totalInclVat?: number | null;
  } | null;
  forensicAlerts?: string[] | null;
  foreignVatAmount?: number | null;
  foreignVatAmountInCHF?: number | null;
  foreignVatNeedsReconciliation?: boolean | null;
};

export type FxSwissVatResult = FxSwissVatInput & {
  originalCurrency: string;
  totalAmount: number;
  netAmount: number;
  vatAmount: number;
  conversionRateUsed: number;
  amountInCHF: number;
  swissVatBreakdown: SwissVatLineLike[];
  swissVatReceiptTotals: {
    merchandiseSubtotal: number;
    vatTotal: number;
    deposit: number;
    totalInclVat: number;
  };
  forensicAlerts: string[];
  foreignVatAmount: number;
  foreignVatAmountInCHF: number;
  foreignVatNeedsReconciliation: boolean;
};

const RATE_EPS = 0.35;

export function roundMoney2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function normalizeCurrencyCode(raw: unknown, fallback = "CHF"): string {
  const c = String(raw || fallback)
    .trim()
    .toUpperCase();
  if (!c || c === "---") return fallback;
  return c.slice(0, 8);
}

/** True when invoice currency differs from the reporting currency (typically CHF). */
export function isForeignCurrency(
  originalCurrency: unknown,
  reportingCurrency = "CHF"
): boolean {
  const from = normalizeCurrencyCode(originalCurrency, reportingCurrency);
  const to = normalizeCurrencyCode(reportingCurrency, "CHF");
  return from !== to;
}

/**
 * Map a printed foreign VAT % to the nearest Swiss filing rate (helper for
 * domestic-style remaps / legacy helpers — import path uses 0% Swiss + recon).
 */
export function mapForeignVatRateToSwiss(foreignRatePercent: number): number {
  const r = Number(foreignRatePercent);
  if (!Number.isFinite(r) || r <= RATE_EPS) return 0;
  if (Math.abs(r - 8.1) <= RATE_EPS || Math.abs(r - 7.7) <= RATE_EPS) return 8.1;
  if (Math.abs(r - 2.6) <= RATE_EPS || Math.abs(r - 2.5) <= RATE_EPS) return 2.6;
  if (r >= 15) return 8.1;
  if (r >= 4) return 2.6;
  return 8.1;
}

/** Infer Swiss rate from foreign amounts when vatRate is missing. */
export function inferSwissRateFromForeignAmounts(
  foreignNet: number,
  foreignVat: number,
  foreignRate?: number | null
): number {
  if (foreignRate != null && Number.isFinite(Number(foreignRate)) && Number(foreignRate) > 0) {
    return mapForeignVatRateToSwiss(Number(foreignRate));
  }
  if (foreignNet > 0.004 && foreignVat > 0.004) {
    return mapForeignVatRateToSwiss((foreignVat / foreignNet) * 100);
  }
  if (foreignVat > 0.004) return 8.1;
  return 0;
}

function emptyRecon(alerts: string[] = []): Pick<
  FxSwissVatResult,
  "foreignVatAmount" | "foreignVatAmountInCHF" | "foreignVatNeedsReconciliation" | "forensicAlerts"
> {
  return {
    foreignVatAmount: 0,
    foreignVatAmountInCHF: 0,
    foreignVatNeedsReconciliation: false,
    forensicAlerts: alerts,
  };
}

/**
 * Convert foreign invoice HT/TTC to CHF.
 * Swiss table: CHF HT at 0% Swiss TVA (do not copy EU %).
 * Foreign VAT → reconciliation flag (not Swiss form code 400).
 * amountInCHF = TTC × rate (cash leaving the business).
 */
export function applyFxAndSwissVatRemap(
  data: FxSwissVatInput,
  rate: number,
  reportingCurrency = "CHF"
): FxSwissVatResult {
  const from = normalizeCurrencyCode(data.originalCurrency, reportingCurrency);
  const to = normalizeCurrencyCode(reportingCurrency, "CHF");
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;

  const foreignGross = roundMoney2(Number(data.totalAmount || 0));
  const foreignVat = roundMoney2(Number(data.vatAmount || 0));
  const foreignNet = roundMoney2(
    Number(data.netAmount || 0) || Math.max(foreignGross - foreignVat, 0)
  );

  if (from === to || safeRate === 1) {
    const chf = foreignGross || roundMoney2(Number(data.amountInCHF || 0));
    return {
      ...data,
      originalCurrency: from,
      totalAmount: foreignGross,
      netAmount: foreignNet,
      vatAmount: foreignVat,
      conversionRateUsed: 1,
      amountInCHF: chf,
      swissVatBreakdown: Array.isArray(data.swissVatBreakdown)
        ? data.swissVatBreakdown.map((l) => ({
            ratePercent: Number(l.ratePercent) || 0,
            baseExclusive: roundMoney2(Number(l.baseExclusive) || 0),
            vatAmount: roundMoney2(Number(l.vatAmount) || 0),
          }))
        : [],
      swissVatReceiptTotals: {
        merchandiseSubtotal: roundMoney2(
          Number(data.swissVatReceiptTotals?.merchandiseSubtotal ?? foreignNet)
        ),
        vatTotal: roundMoney2(Number(data.swissVatReceiptTotals?.vatTotal ?? foreignVat)),
        deposit: roundMoney2(Number(data.swissVatReceiptTotals?.deposit ?? 0)),
        totalInclVat: roundMoney2(
          Number(data.swissVatReceiptTotals?.totalInclVat ?? foreignGross) || chf
        ),
      },
      ...emptyRecon(Array.isArray(data.forensicAlerts) ? [...data.forensicAlerts] : []),
    };
  }

  // Non-CHF reporting (e.g. UK GBP): convert cash total only, no Swiss import remap.
  if (to !== "CHF") {
    const amountInCHF = roundMoney2(foreignGross * safeRate);
    return {
      ...data,
      originalCurrency: from,
      totalAmount: foreignGross,
      netAmount: foreignNet,
      vatAmount: foreignVat,
      conversionRateUsed: safeRate,
      amountInCHF,
      swissVatBreakdown: Array.isArray(data.swissVatBreakdown)
        ? data.swissVatBreakdown.map((l) => ({
            ratePercent: Number(l.ratePercent) || 0,
            baseExclusive: roundMoney2(Number(l.baseExclusive) || 0),
            vatAmount: roundMoney2(Number(l.vatAmount) || 0),
          }))
        : [],
      swissVatReceiptTotals: {
        merchandiseSubtotal: roundMoney2(
          Number(data.swissVatReceiptTotals?.merchandiseSubtotal ?? 0)
        ),
        vatTotal: roundMoney2(Number(data.swissVatReceiptTotals?.vatTotal ?? 0)),
        deposit: roundMoney2(Number(data.swissVatReceiptTotals?.deposit ?? 0)),
        totalInclVat: roundMoney2(
          Number(data.swissVatReceiptTotals?.totalInclVat ?? amountInCHF)
        ),
      },
      ...emptyRecon(Array.isArray(data.forensicAlerts) ? [...data.forensicAlerts] : []),
    };
  }

  // Swiss books + foreign invoice (Josh/Damien): HT→CHF, TTC→CHF cash out,
  // Swiss TVA 0% on CHF HT, foreign VAT flagged for reconciliation.
  const chfNet = roundMoney2(foreignNet * safeRate);
  const chfPaid = roundMoney2(foreignGross * safeRate);
  const foreignVatInChf = roundMoney2(foreignVat * safeRate);
  const needsRecon = foreignVat > 0.004;

  const swissVatBreakdown: SwissVatLineLike[] = [
    { ratePercent: 0, baseExclusive: chfNet, vatAmount: 0 },
    { ratePercent: 2.6, baseExclusive: 0, vatAmount: 0 },
    { ratePercent: 8.1, baseExclusive: 0, vatAmount: 0 },
  ];

  const alerts = new Set(Array.isArray(data.forensicAlerts) ? data.forensicAlerts : []);
  alerts.add(
    `FX ${from}→CHF @ ${safeRate.toFixed(4)}: CHF HT ${chfNet.toFixed(2)}, cash out CHF ${chfPaid.toFixed(2)}. Foreign VAT ${foreignVat.toFixed(2)} ${from} (${foreignVatInChf.toFixed(2)} CHF) flagged for reconciliation — not Swiss filing TVA.`
  );

  return {
    ...data,
    originalCurrency: from,
    totalAmount: foreignGross,
    netAmount: foreignNet,
    vatAmount: foreignVat,
    conversionRateUsed: safeRate,
    amountInCHF: chfPaid,
    swissVatBreakdown,
    swissVatReceiptTotals: {
      merchandiseSubtotal: chfNet,
      vatTotal: 0,
      deposit: 0,
      // Cash leaving the business (TTC × rate), not HT+SwissVAT.
      totalInclVat: chfPaid,
    },
    foreignVatAmount: foreignVat,
    foreignVatAmountInCHF: foreignVatInChf,
    foreignVatNeedsReconciliation: needsRecon,
    forensicAlerts: [...alerts],
  };
}

/** Static fallbacks when live FX APIs fail (approx mid-2026 EUR/CHF band). */
export const FX_FALLBACK_RATES: Record<string, number> = {
  "EUR:CHF": 0.94,
  "USD:CHF": 0.88,
  "GBP:CHF": 1.12,
  "CHF:EUR": 1.064,
  "CHF:USD": 1.136,
  "CHF:GBP": 0.893,
};

export function fallbackFxRate(from: string, to: string): number {
  const key = `${normalizeCurrencyCode(from)}:${normalizeCurrencyCode(to)}`;
  const rev = `${normalizeCurrencyCode(to)}:${normalizeCurrencyCode(from)}`;
  if (FX_FALLBACK_RATES[key]) return FX_FALLBACK_RATES[key];
  if (FX_FALLBACK_RATES[rev]) return roundMoney2(1 / FX_FALLBACK_RATES[rev]);
  return 1;
}
