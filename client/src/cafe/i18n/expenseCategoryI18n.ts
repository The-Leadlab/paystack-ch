import { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

/** Maps detection category id → LanguageContext / dashboard translation key */
export const EXPENSE_CAT_KEYS: Record<string, string> = {
  SALARY: 'catSalary',
  PAYROLL_TAXES: 'catPayrollTaxes',
  RENT: 'catRent',
  UTILITIES: 'catUtilities',
  INSURANCE: 'catInsurance',
  FOOD_SUPPLIES: 'catFoodSupplies',
  BEVERAGES: 'catBeverages',
  RESTAURANT_SUPPLIES: 'catRestaurantSupplies',
  PACKAGING: 'catPackaging',
  CLEANING: 'catCleaning',
  MAINTENANCE: 'catMaintenance',
  BANK_FEES: 'catBankFees',
  ACCOUNTING: 'catAccounting',
  MARKETING: 'catMarketing',
  DELIVERY: 'catDelivery',
  TELECOM: 'catTelecom',
  OFFICE_SUPPLIES: 'catOfficeSupplies',
  LICENSES: 'catLicenses',
  TAXES: 'catTaxes',
  OTHER: 'catOther',
};

export const EXPENSE_GROUP_KEYS: Record<string, string> = {
  Personnel: 'catGroupPersonnel',
  Inventory: 'catGroupInventory',
  'Fixed Costs': 'catGroupFixedCosts',
  Operations: 'catGroupOperations',
  Financial: 'catGroupFinancial',
  Marketing: 'catGroupMarketing',
  Legal: 'catGroupLegal',
  Other: 'catGroupOther',
};

export const RESTAURANT_CATEGORY_IDS = [
  'SALARY',
  'PAYROLL_TAXES',
  'RENT',
  'UTILITIES',
  'INSURANCE',
  'FOOD_SUPPLIES',
  'BEVERAGES',
  'RESTAURANT_SUPPLIES',
  'PACKAGING',
  'CLEANING',
  'MAINTENANCE',
  'BANK_FEES',
  'ACCOUNTING',
  'MARKETING',
  'DELIVERY',
  'TELECOM',
  'OFFICE_SUPPLIES',
  'LICENSES',
  'TAXES',
  'OTHER',
] as const;

export const CATEGORY_GROUP_IDS = [
  'Personnel',
  'Inventory',
  'Fixed Costs',
  'Operations',
  'Financial',
  'Marketing',
  'Legal',
  'Other',
] as const;

export type RestaurantCategory = { id: string; label: string; group: string };
export type CategoryGroup = { id: string; label: string };

const RAW_CATEGORIES: Omit<RestaurantCategory, 'label'>[] = [
  { id: 'SALARY', group: 'Personnel' },
  { id: 'PAYROLL_TAXES', group: 'Personnel' },
  { id: 'RENT', group: 'Fixed Costs' },
  { id: 'UTILITIES', group: 'Fixed Costs' },
  { id: 'INSURANCE', group: 'Fixed Costs' },
  { id: 'FOOD_SUPPLIES', group: 'Inventory' },
  { id: 'BEVERAGES', group: 'Inventory' },
  { id: 'RESTAURANT_SUPPLIES', group: 'Inventory' },
  { id: 'PACKAGING', group: 'Inventory' },
  { id: 'CLEANING', group: 'Operations' },
  { id: 'MAINTENANCE', group: 'Operations' },
  { id: 'BANK_FEES', group: 'Financial' },
  { id: 'ACCOUNTING', group: 'Financial' },
  { id: 'MARKETING', group: 'Marketing' },
  { id: 'DELIVERY', group: 'Operations' },
  { id: 'TELECOM', group: 'Fixed Costs' },
  { id: 'OFFICE_SUPPLIES', group: 'Operations' },
  { id: 'LICENSES', group: 'Legal' },
  { id: 'TAXES', group: 'Financial' },
  { id: 'OTHER', group: 'Other' },
];

export function labelCategoryId(id: string, t: (key: string) => string): string {
  const key = EXPENSE_CAT_KEYS[id];
  return key ? t(key) : id;
}

export function useExpenseCategoryMeta() {
  const { t, language } = useLanguage();

  return useMemo(() => {
    const categories: RestaurantCategory[] = RAW_CATEGORIES.map((c) => ({
      ...c,
      label: labelCategoryId(c.id, t),
    }));
    const groups: CategoryGroup[] = CATEGORY_GROUP_IDS.map((id) => ({
      id,
      label: t(EXPENSE_GROUP_KEYS[id] ?? id),
    }));
    return { categories, groups };
  }, [t, language]);
}
