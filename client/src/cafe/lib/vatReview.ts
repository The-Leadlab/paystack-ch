import { SWISS_VAT_RATES } from '@shared/swissVatRates';

const RATE_EPS = 0.15;

export type VatReviewReason = 'missing_vat' | 'non_swiss_rate' | 'zero_rate_unconfirmed';

export type VatReviewResult = {
  needsAction: boolean;
  reasons: VatReviewReason[];
  rates: number[];
};

function collectRates(data: {
  vatAmount?: number | null;
  vatRate?: number | null;
  swissVatBreakdown?: Array<{ ratePercent?: number | null }> | null;
  subDocuments?: Array<{ vatRate?: number | null }> | null;
}): number[] {
  const swiss = data.swissVatBreakdown;
  if (swiss && swiss.length > 0) {
    return swiss.map((l) => Number(l.ratePercent || 0)).filter((r) => Number.isFinite(r));
  }
  const subs = data.subDocuments;
  if (subs && subs.length > 0) {
    return subs.map((s) => Number(s.vatRate || 0)).filter((r) => Number.isFinite(r));
  }
  const single = Number(data.vatRate ?? NaN);
  return Number.isFinite(single) ? [single] : [];
}

export function isSwissVatRate(rate: number): boolean {
  return SWISS_VAT_RATES.some((allowed) => Math.abs(allowed - rate) <= RATE_EPS);
}

/**
 * Documents need manual VAT confirmation when amount is missing/zero without confirmation,
 * or when any extracted rate is outside Swiss presets (0 / 2.6 / 8.1).
 */
export function evaluateVatReview(
  data:
    | {
        vatAmount?: number | null;
        vatRate?: number | null;
        vatConfirmed?: boolean | null;
        swissVatBreakdown?: Array<{ ratePercent?: number | null }> | null;
        subDocuments?: Array<{ vatRate?: number | null }> | null;
      }
    | null
    | undefined
): VatReviewResult {
  if (!data) return { needsAction: false, reasons: [], rates: [] };
  if (data.vatConfirmed) return { needsAction: false, reasons: [], rates: collectRates(data) };

  const reasons: VatReviewReason[] = [];
  const rates = collectRates(data);
  const vatAmount = Number(data.vatAmount || 0);

  const nonSwiss = rates.filter((r) => r > 0 && !isSwissVatRate(r));
  if (nonSwiss.length > 0) reasons.push('non_swiss_rate');

  const onlyZero = rates.length > 0 && rates.every((r) => Math.abs(r) <= RATE_EPS);
  if (vatAmount <= 0 || onlyZero || rates.length === 0) {
    if (vatAmount <= 0 && (onlyZero || rates.length === 0)) {
      reasons.push(rates.length === 0 ? 'missing_vat' : 'zero_rate_unconfirmed');
    } else if (vatAmount <= 0) {
      reasons.push('missing_vat');
    }
  }

  return { needsAction: reasons.length > 0, reasons, rates };
}
