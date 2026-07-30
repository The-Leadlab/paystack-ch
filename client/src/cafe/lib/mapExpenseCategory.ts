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
  const cat = (opts.expenseCategory || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  const blob = haystack(opts.expenseCategory, opts.issuer, opts.description, opts.notes, opts.documentType);

  if (opts.documentType?.toLowerCase().includes('pay')) return 'PAYROLL';

  // Fine AI categories (FOOD_SUPPLIES, RENT, …) → ledger enum first
  const fromFine = mapFineCategoryToLedger((opts.expenseCategory || '').toUpperCase().replace(/\s+/g, '_'));
  if (fromFine !== 'OTHER') return fromFine;

  if (includesAny(cat, PAYROLL_TAX_HINTS) || includesAny(blob, PAYROLL_TAX_HINTS)) {
    return 'PAYROLL_TAXES';
  }
  if (includesAny(cat, PAYROLL_HINTS) || includesAny(blob, PAYROLL_HINTS)) {
    return 'PAYROLL';
  }
  if (includesAny(cat, SUPPLIER_HINTS) || includesAny(blob, SUPPLIER_HINTS)) {
    return 'SUPPLIERS';
  }
  if (includesAny(cat, BILL_HINTS) || includesAny(blob, BILL_HINTS)) {
    return 'BILLS';
  }

  // Exact coarse enums from AI
  if (cat === 'suppliers' || cat === 'supplier') return 'SUPPLIERS';
  if (cat === 'bills' || cat === 'bill') return 'BILLS';
  if (cat === 'payroll') return 'PAYROLL';
  if (cat === 'payroll taxes' || cat === 'payroll_taxes') return 'PAYROLL_TAXES';

  // Keyword detector on issuer + description before OTHER
  const detected = detectCategory(
    `${opts.description || ''} ${opts.notes || ''}`,
    opts.issuer || undefined
  );
  const fromDetector = mapFineCategoryToLedger(detected);
  if (fromDetector !== 'OTHER') return fromDetector;

  // Restaurant default: supplier invoice when document looks like a purchase invoice
  const dtype = (opts.documentType || '').toLowerCase();
  if (dtype.includes('invoice') || dtype.includes('facture') || dtype.includes('receipt')) {
    return 'SUPPLIERS';
  }

  return 'OTHER';
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
