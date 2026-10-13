/** Map AI / detector fine categories + issuer text → business ledger enum. */

import type { Expense } from '../types';
import { detectCategory } from '../services/categoryDetectionService';

export type LedgerExpenseCategory = Expense['category'];

const SUPPLIER_HINTS = [
  'supplier',
  'suppliers',
  'food',
  'beverage',
  'beverages',
  'grocery',
  'groceries',
  'inventory',
  'produce',
  'meat',
  'fish',
  'bakery',
  'dairy',
  'wholesale',
  'wholesaler',
  'aligro',
  'transgourmet',
  'prodega',
  'demaurex',
  'boucherie',
  'charcuterie',
  'migros',
  'coop',
  'costco',
  'supplies',
  'ingredient',
  'ingredients',
];

const BILL_HINTS = [
  'bill',
  'bills',
  'rent',
  'lease',
  'utility',
  'utilities',
  'electric',
  'electricity',
  'gas',
  'water',
  'insurance',
  'telecom',
  'phone',
  'internet',
  'subscription',
  'software',
  'saas',
  'office',
  'accounting',
  'fiduciary',
  'lawyer',
  'legal',
  'bank fee',
  'fees',
  'cleaning',
  'maintenance',
  'repair',
  'waste',
  'garbage',
  'parking',
  'license',
  'permit',
];

const PAYROLL_HINTS = [
  'salary',
  'payroll',
  'payslip',
  'pay slip',
  'wage',
  'wages',
  'employee',
  'staff',
];

const PAYROLL_TAX_HINTS = [
  'payroll_tax',
  'payroll tax',
  'ahv',
  'avs',
  'social contribution',
  'social_security',
  'lavs',
  'lpp',
  'uvg',
  'nbu',
];

function haystack(...parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function includesAny(text: string, hints: string[]): boolean {
  return hints.some((h) => text.includes(h));
}

const FINE_CATEGORY_IDS = new Set([
  'FOOD_SUPPLIES',
  'BEVERAGES',
  'RESTAURANT_SUPPLIES',
  'PACKAGING',
  'CLEANING',
  'MAINTENANCE',
  'RENT',
  'UTILITIES',
  'INSURANCE',
  'TELECOM',
  'BANK_FEES',
  'ACCOUNTING',
  'MARKETING',
  'DELIVERY',
  'OFFICE_SUPPLIES',
  'LICENSES',
  'TAXES',
  'PAYROLL',
  'PAYROLL_TAXES',
  'SALARY',
  'SUPPLIERS',
  'BILLS',
]);

/**
 * Resolve the accountant-level fine category (FOOD_SUPPLIES, RENT, …)
 * before collapsing to the 5-way ledger enum. Used for reports + Swiss konto.
 */
export function resolveFineExpenseCategory(opts: {
  expenseCategory?: string | null;
  issuer?: string | null;
  description?: string | null;
  notes?: string | null;
  documentType?: string | null;
}): string {
  if (opts.documentType?.toLowerCase().includes('pay')) return 'PAYROLL';

  const raw = (opts.expenseCategory || '').toUpperCase().replace(/[\s-]+/g, '_').trim();
  if (raw === 'REVENUE' || raw === 'SALES' || raw.includes('RESERV')) return raw;
  if (FINE_CATEGORY_IDS.has(raw) && raw !== 'OTHER') return raw === 'SALARY' ? 'PAYROLL' : raw;

  const detected = detectCategory(
    `${opts.description || ''} ${opts.notes || ''} ${opts.expenseCategory || ''}`,
    opts.issuer || undefined
  );
  if (detected && detected !== 'OTHER') return detected === 'SALARY' ? 'PAYROLL' : detected;

  const blob = haystack(opts.expenseCategory, opts.issuer, opts.description, opts.notes, opts.documentType);
  if (includesAny(blob, PAYROLL_TAX_HINTS)) return 'PAYROLL_TAXES';
  if (includesAny(blob, PAYROLL_HINTS)) return 'PAYROLL';
  if (includesAny(blob, SUPPLIER_HINTS)) return 'SUPPLIERS';
  if (includesAny(blob, BILL_HINTS)) return 'BILLS';

  const dtype = (opts.documentType || '').toLowerCase();
  if (dtype.includes('invoice') || dtype.includes('facture') || dtype.includes('receipt')) {
    return 'SUPPLIERS';
  }
  return 'OTHER';
}

/**
 * Prefer fine AI category, then issuer/description heuristics.
 * OTHER is the fallback exception — not the default for restaurant suppliers/bills.
 */
export function mapAiExpenseCategoryToLedger(opts: {
  expenseCategory?: string | null;
  issuer?: string | null;
  description?: string | null;
  notes?: string | null;
  documentType?: string | null;
}): LedgerExpenseCategory {
  return mapFineCategoryToLedger(resolveFineExpenseCategory(opts));
}

function mapFineCategoryToLedger(fine: string): LedgerExpenseCategory {
  const c = fine.toUpperCase();
  if (c === 'SALARY' || c === 'PAYROLL') return 'PAYROLL';
  if (c === 'PAYROLL_TAXES' || c === 'TAXES') return 'PAYROLL_TAXES';
  if (
    c === 'FOOD_SUPPLIES' ||
    c === 'BEVERAGES' ||
    c === 'RESTAURANT_SUPPLIES' ||
    c === 'PACKAGING' ||
    c === 'CLEANING' ||
    c === 'DELIVERY'
  ) {
    return 'SUPPLIERS';
  }
  if (
    c === 'RENT' ||
    c === 'UTILITIES' ||
    c === 'INSURANCE' ||
    c === 'TELECOM' ||
    c === 'BANK_FEES' ||
    c === 'ACCOUNTING' ||
    c === 'MARKETING' ||
    c === 'OFFICE_SUPPLIES' ||
    c === 'LICENSES' ||
    c === 'MAINTENANCE'
  ) {
    return 'BILLS';
  }
  return 'OTHER';
}
