/**
 * UK VAT return (9-box) builder from Paystack ledger rows.
 * Spec-oriented toward HMRC VAT (MTD) API boxes 1–9.
 */

export type UkVatLedgerIncome = {
  amount: number;
  vat_amount?: number | null;
  date?: string | null;
};

export type UkVatLedgerExpense = {
  amount: number;
  vat_amount?: number | null;
  category?: string | null;
  date?: string | null;
};

export type UkVatStagger = "mar" | "apr" | "may" | "monthly";

export type UkVatReturnBoxes = {
  box1_vatDueSales: number;
  box2_vatDueAcquisitions: number;
  box3_totalVatDue: number;
  box4_vatReclaimedCurrPeriod: number;
  box5_netVatDue: number;
  box5_direction: "payable" | "repayable" | "nil";
  box6_totalValueSalesExVAT: number;
  box7_totalValuePurchasesExVAT: number;
  box8_totalValueSuppliesExVAT: number;
  box9_totalValueAcquisitionsExVAT: number;
  salesMissingVat: number;
  purchasesMissingVat: number;
  periodStart: string;
  periodEnd: string;
};

const PAYROLL_CATEGORIES = new Set(["PAYROLL", "PAYROLL_TAXES", "payroll", "payroll_taxes"]);

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Whole pounds for boxes 6–9 per HMRC API (nearest pound). */
function wholePounds(n: number): number {
  return Math.round(n);
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(d: Date | null, start: Date, end: Date): boolean {
  if (!d) return true;
  return d >= start && d <= end;
}

export function ukVatQuarterBounds(
  year: number,
  quarterIndex: 0 | 1 | 2 | 3,
  stagger: UkVatStagger
): { start: Date; end: Date } {
  if (stagger === "monthly") {
    const start = new Date(Date.UTC(year, quarterIndex, 1));
    const end = new Date(Date.UTC(year, quarterIndex + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }
  const endMonthByStagger: Record<Exclude<UkVatStagger, "monthly">, number[]> = {
    mar: [2, 5, 8, 11],
    apr: [3, 6, 9, 0],
    may: [4, 7, 10, 1],
  };
  const endMonth = endMonthByStagger[stagger][quarterIndex];
  let endYear = year;
  if (stagger === "apr" && quarterIndex === 3) endYear = year + 1;
  if (stagger === "may" && quarterIndex >= 2) {
    /* May/Aug/Nov/Feb — Q3 ends Feb of next year */
  }
  if (stagger === "may" && quarterIndex === 3) endYear = year + 1;

  const end = new Date(Date.UTC(endYear, endMonth + 1, 0, 23, 59, 59, 999));
  const startMonth = endMonth - 2;
  let startYear = endYear;
  let sm = startMonth;
  if (sm < 0) {
    sm += 12;
    startYear -= 1;
  }
  const start = new Date(Date.UTC(startYear, sm, 1));
  return { start, end };
}

export function buildUkVatReturn(
  income: UkVatLedgerIncome[],
  expenses: UkVatLedgerExpense[],
  opts: { start: Date; end: Date }
): UkVatReturnBoxes {
  const { start, end } = opts;
  let vatDueSales = 0;
  let salesExVat = 0;
  let salesMissingVat = 0;

  for (const row of income) {
    const d = parseDate(row.date ?? null);
    if (!inRange(d, start, end)) continue;
    const gross = Number(row.amount) || 0;
    const vat = Number(row.vat_amount);
    if (!Number.isFinite(vat) || vat === 0) {
      if (gross !== 0) salesMissingVat += 1;
      salesExVat += gross;
    } else {
      vatDueSales += vat;
      salesExVat += gross - vat;
    }
  }

  let vatReclaimed = 0;
  let purchasesExVat = 0;
  let purchasesMissingVat = 0;

  for (const row of expenses) {
    const cat = String(row.category || "").toUpperCase();
    if (PAYROLL_CATEGORIES.has(cat) || PAYROLL_CATEGORIES.has(String(row.category || ""))) {
      continue;
    }
    const d = parseDate(row.date ?? null);
    if (!inRange(d, start, end)) continue;
    const gross = Number(row.amount) || 0;
    const vat = Number(row.vat_amount);
    if (!Number.isFinite(vat) || vat === 0) {
      if (gross !== 0) purchasesMissingVat += 1;
      purchasesExVat += gross;
    } else {
      vatReclaimed += vat;
      purchasesExVat += gross - vat;
    }
  }

  const box1 = round2(vatDueSales);
  const box2 = 0;
  const box3 = round2(box1 + box2);
  const box4 = round2(vatReclaimed);
  const net = round2(box3 - box4);
  const box5 = Math.abs(net);
  const direction: UkVatReturnBoxes["box5_direction"] =
    net > 0.004 ? "payable" : net < -0.004 ? "repayable" : "nil";

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return {
    box1_vatDueSales: box1,
    box2_vatDueAcquisitions: box2,
    box3_totalVatDue: box3,
    box4_vatReclaimedCurrPeriod: box4,
    box5_netVatDue: box5,
    box5_direction: direction,
    box6_totalValueSalesExVAT: wholePounds(salesExVat),
    box7_totalValuePurchasesExVAT: wholePounds(purchasesExVat),
    box8_totalValueSuppliesExVAT: 0,
    box9_totalValueAcquisitionsExVAT: 0,
    salesMissingVat,
    purchasesMissingVat,
    periodStart: iso(start),
    periodEnd: iso(end),
  };
}
