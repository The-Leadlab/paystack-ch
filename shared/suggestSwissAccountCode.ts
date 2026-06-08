import { getSwissAccount } from "./swissChartOfAccounts";

/** Default Plan comptable CH konto for app expense category ids (restaurant + legacy). */
const EXPENSE_CATEGORY_KONTO: Record<string, string> = {
  BILLS: "6400",
  SUPPLIERS: "4200",
  PAYROLL: "5200",
  PAYROLL_TAXES: "5700",
  OTHER: "6790",
  SALARY: "5200",
  RENT: "6004",
  UTILITIES: "6400",
  INSURANCE: "6310",
  FOOD_SUPPLIES: "4200",
  BEVERAGES: "4200",
  RESTAURANT_SUPPLIES: "4200",
  PACKAGING: "4205",
  CLEANING: "6040",
  MAINTENANCE: "6200",
  BANK_FEES: "6940",
  ACCOUNTING: "6530",
  MARKETING: "6600",
  DELIVERY: "6280",
  TELECOM: "6510",
  OFFICE_SUPPLIES: "6500",
  LICENSES: "6370",
  TAXES: "8900",
};

const INCOME_TYPE_KONTO: Record<string, string> = {
  SALES: "3200",
  RESERVATION: "3400",
};

/** Keyword → asset / expense konto (fixed assets & common purchases). */
const DESCRIPTION_KONTO: [RegExp, string][] = [
  [/machine|machinery|équipement|appareil|equipment/i, "1500"],
  [/vehicle|véhicule|auto|car|camion|truck/i, "1530"],
  [/informatique|computer|laptop|software|logiciel|it\b/i, "1521"],
  [/mobilier|furniture|office chair|bureau/i, "1510"],
  [/immeuble|building|property|immobilier|warehouse|entrepôt/i, "1600"],
  [/brevet|patent|licence|license|marque|brand/i, "1700"],
  [/crypto|bitcoin|eth/i, "1064"],
  [/compte bancaire|bank account|postfinance|ubs|credit suisse/i, "1020"],
  [/caisse|cash on hand|espèces/i, "1000"],
  [/migros|coop|marchandise|inventory|stock/i, "1200"],
  [/loyer|rent|miete/i, "6004"],
  [/salaire|salary|lohn|payroll/i, "5200"],
  [/tva|vat|mwst/i, "1175"],
  [/assurance|insurance|krankenkasse/i, "6310"],
];

export function suggestSwissAccountCode(input: {
  kind: "income" | "expense";
  category?: string;
  incomeType?: string;
  description?: string;
}): string | undefined {
  const desc = input.description || "";
  for (const [re, konto] of DESCRIPTION_KONTO) {
    if (re.test(desc) && getSwissAccount(konto)) return konto;
  }

  if (input.kind === "income") {
    const t = input.incomeType || "SALES";
    const k = INCOME_TYPE_KONTO[t];
    if (k && getSwissAccount(k)) return k;
    return "3200";
  }

  const cat = input.category || "OTHER";
  const k = EXPENSE_CATEGORY_KONTO[cat];
  if (k && getSwissAccount(k)) return k;
  return EXPENSE_CATEGORY_KONTO.OTHER;
}
