/**
 * Border restaurants (e.g. Geneva) receive EUR invoices with foreign VAT (often FR 20%).
 * For Swiss books we keep original-currency amounts, convert HT → CHF, then apply Swiss
 * TVA rates (0 / 2.6 / 8.1) on the CHF base — never keep French 20% on the Swiss table.
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
 * Map a printed foreign VAT % to the nearest Swiss filing rate.
 * FR 20% / DE 19% → 8.1%; reduced bands (~5.5 / 7 / 10) → 2.6%; zero stays 0.
 */
export function mapForeignVatRateToSwiss(foreignRatePercent: number): number {
  const r = Number(foreignRatePercent);
  if (!Number.isFinite(r) || r <= RATE_EPS) return 0;
  if (Math.abs(r - 8.1) <= RATE_EPS || Math.abs(r - 7.7) <= RATE_EPS) return 8.1;
  if (Math.abs(r - 2.6) <= RATE_EPS || Math.abs(r - 2.5) <= RATE_EPS) return 2.6;
  if (r >= 15) return 8.1; // standard EU rates → Swiss standard
  if (r >= 4) return 2.6; // reduced EU rates → Swiss reduced
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

/**
 * Convert foreign invoice HT to CHF and rebuild Swiss TVA rows in CHF.
 * Preserves originalCurrency / totalAmount / netAmount / vatAmount in the invoice currency.
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
      forensicAlerts: Array.isArray(data.forensicAlerts) ? [...data.forensicAlerts] : [],
    };
  }

  // Only remap Swiss TVA when reporting in CHF (not GBP UK UAT).
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
      forensicAlerts: Array.isArray(data.forensicAlerts) ? [...data.forensicAlerts] : [],
    };
  }

  const swissRate = inferSwissRateFromForeignAmounts(foreignNet, foreignVat, data.vatRate);
  const chfNet = roundMoney2(foreignNet * safeRate);
  const chfVat = roundMoney2(chfNet * (swissRate / 100));
  const chfGross = roundMoney2(chfNet + chfVat);

  const rates = [0, 2.6, 8.1] as const;
  const swissVatBreakdown: SwissVatLineLike[] = rates.map((ratePercent) => {
    if (Math.abs(ratePercent - swissRate) <= RATE_EPS && swissRate > 0) {
      return { ratePercent, baseExclusive: chfNet, vatAmount: chfVat };
    }
    if (swissRate <= RATE_EPS && ratePercent === 0) {
      return { ratePercent: 0, baseExclusive: chfNet, vatAmount: 0 };
    }
    return { ratePercent, baseExclusive: 0, vatAmount: 0 };
  });

  const alerts = new Set(Array.isArray(data.forensicAlerts) ? data.forensicAlerts : []);
  alerts.add(
    `FX ${from}→CHF @ ${safeRate.toFixed(4)}: Swiss TVA ${swissRate}% applied on CHF HT ${chfNet.toFixed(2)} (foreign VAT not used for Swiss filing).`
  );

  return {
    ...data,
    originalCurrency: from,
    totalAmount: foreignGross,
    netAmount: foreignNet,
    vatAmount: foreignVat,
    conversionRateUsed: safeRate,
    amountInCHF: chfGross,
    swissVatBreakdown,
    swissVatReceiptTotals: {
      merchandiseSubtotal: chfNet,
      vatTotal: chfVat,
      deposit: 0,
      totalInclVat: chfGross,
    },
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
