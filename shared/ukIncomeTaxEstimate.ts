/**
 * UK sole-trader income tax / Class 4 NI *estimate* (England/Wales/NI).
 * Not tax advice. Scotland out of scope. No MTD Income Tax submission.
 */

export type UkTaxYearId = "2025-26" | "2026-27";

export type UkIncomeTaxEstimateInput = {
  taxYear: UkTaxYearId;
  turnover: number;
  allowableExpenses: number;
};

export type UkIncomeTaxEstimate = {
  taxYear: UkTaxYearId;
  taxYearStart: string;
  taxYearEnd: string;
  turnover: number;
  allowableExpenses: number;
  netProfit: number;
  personalAllowance: number;
  taxableIncome: number;
  incomeTaxEstimate: number;
  class4NiEstimate: number;
  totalEstimate: number;
  disclaimer: string;
};

type Band = { upTo: number; rate: number };

const RATES: Record<
  UkTaxYearId,
  {
    start: string;
    end: string;
    personalAllowance: number;
    bands: Band[];
    class4Lower: number;
    class4Upper: number;
    class4RateMain: number;
    class4RateUpper: number;
  }
> = {
  "2025-26": {
    start: "2025-04-06",
    end: "2026-04-05",
    personalAllowance: 12570,
    bands: [
      { upTo: 37700, rate: 0.2 },
      { upTo: 125140, rate: 0.4 },
      { upTo: Infinity, rate: 0.45 },
    ],
    class4Lower: 12570,
    class4Upper: 50270,
    class4RateMain: 0.06,
    class4RateUpper: 0.02,
  },
  "2026-27": {
    start: "2026-04-06",
    end: "2027-04-05",
    personalAllowance: 12570,
    bands: [
      { upTo: 37700, rate: 0.2 },
      { upTo: 125140, rate: 0.4 },
      { upTo: Infinity, rate: 0.45 },
    ],
    class4Lower: 12570,
    class4Upper: 50270,
    class4RateMain: 0.06,
    class4RateUpper: 0.02,
  },
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function ukTaxYearBounds(taxYear: UkTaxYearId): { start: Date; end: Date } {
  const r = RATES[taxYear];
  return { start: new Date(`${r.start}T00:00:00.000Z`), end: new Date(`${r.end}T23:59:59.999Z`) };
}

export function resolveUkTaxYearId(date: Date = new Date()): UkTaxYearId {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  // Tax year starts 6 April
  if (m > 3 || (m === 3 && day >= 6)) {
    const id = `${y}-${String(y + 1).slice(2)}` as UkTaxYearId;
    return id in RATES ? id : "2026-27";
  }
  const id = `${y - 1}-${String(y).slice(2)}` as UkTaxYearId;
  return id in RATES ? id : "2025-26";
}

function taxOn(taxable: number, bands: Band[]): number {
  let remaining = Math.max(0, taxable);
  let prev = 0;
  let tax = 0;
  for (const band of bands) {
    const width = band.upTo - prev;
    const slice = Math.min(remaining, width);
    tax += slice * band.rate;
    remaining -= slice;
    prev = band.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

export function buildUkIncomeTaxEstimate(input: UkIncomeTaxEstimateInput): UkIncomeTaxEstimate {
  const cfg = RATES[input.taxYear];
  const turnover = Math.max(0, Number(input.turnover) || 0);
  const expenses = Math.max(0, Number(input.allowableExpenses) || 0);
  const netProfit = round2(turnover - expenses);
  const personalAllowance = cfg.personalAllowance;
  const taxableIncome = round2(Math.max(0, netProfit - personalAllowance));
  const incomeTaxEstimate = round2(taxOn(taxableIncome, cfg.bands));

  let class4 = 0;
  if (netProfit > cfg.class4Lower) {
    const mainBand = Math.min(netProfit, cfg.class4Upper) - cfg.class4Lower;
    class4 += Math.max(0, mainBand) * cfg.class4RateMain;
    if (netProfit > cfg.class4Upper) {
      class4 += (netProfit - cfg.class4Upper) * cfg.class4RateUpper;
    }
  }
  const class4NiEstimate = round2(class4);

  return {
    taxYear: input.taxYear,
    taxYearStart: cfg.start,
    taxYearEnd: cfg.end,
    turnover: round2(turnover),
    allowableExpenses: round2(expenses),
    netProfit,
    personalAllowance,
    taxableIncome,
    incomeTaxEstimate,
    class4NiEstimate,
    totalEstimate: round2(incomeTaxEstimate + class4NiEstimate),
    disclaimer:
      "Estimate only for sole traders in England/Wales/NI. Not tax advice. Review with an accountant before filing.",
  };
}
