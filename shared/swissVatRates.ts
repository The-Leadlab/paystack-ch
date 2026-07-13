/** Standard Swiss VAT rates (2024+). */
export const SWISS_VAT_RATES = [0, 2.6, 8.1] as const;

export const DEFAULT_SWISS_VAT_RATE = 8.1;

export type SwissVatRate = (typeof SWISS_VAT_RATES)[number];
