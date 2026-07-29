import { describe, expect, it } from 'vitest';
import { mapAiExpenseCategoryToLedger } from '../client/src/cafe/lib/mapExpenseCategory';
import { evaluateVatReview } from '../client/src/cafe/lib/vatReview';
import { isLikelyPersonalExpenseDescription } from '../client/src/cafe/lib/personalBleedFilter';
import { parseBudgetAmount } from '../client/src/ali-lab/lib/parseBudgetAmount';
import { buildProfitability } from '../client/src/cafe/lib/revenueAnalytics';

describe('mapAiExpenseCategoryToLedger', () => {
  it('maps wholesaler issuers to SUPPLIERS', () => {
    expect(
      mapAiExpenseCategoryToLedger({
        expenseCategory: 'FOOD_SUPPLIES',
        issuer: 'ALIGRO DEMAUREX & CIE SA',
      })
    ).toBe('SUPPLIERS');
  });

  it('maps rent/utilities to BILLS', () => {
    expect(mapAiExpenseCategoryToLedger({ expenseCategory: 'RENT' })).toBe('BILLS');
    expect(mapAiExpenseCategoryToLedger({ description: 'Electricity invoice' })).toBe('BILLS');
  });

  it('maps payroll keywords', () => {
    expect(mapAiExpenseCategoryToLedger({ documentType: 'Pay Slip' })).toBe('PAYROLL');
  });
});

describe('evaluateVatReview', () => {
  it('flags zero VAT as needing action', () => {
    const r = evaluateVatReview({ vatAmount: 0, vatRate: 0 });
    expect(r.needsAction).toBe(true);
  });

  it('passes confirmed VAT', () => {
    const r = evaluateVatReview({ vatAmount: 0, vatRate: 0, vatConfirmed: true });
    expect(r.needsAction).toBe(false);
  });

  it('flags non-Swiss rates', () => {
    const r = evaluateVatReview({ vatAmount: 10, vatRate: 20 });
    expect(r.needsAction).toBe(true);
    expect(r.reasons).toContain('non_swiss_rate');
  });
});

describe('personalBleedFilter', () => {
  it('detects personal description prefixes', () => {
    expect(isLikelyPersonalExpenseDescription('Groceries')).toBe(true);
    expect(isLikelyPersonalExpenseDescription('Going out: Mcdo')).toBe(true);
    expect(isLikelyPersonalExpenseDescription('ALIGRO DEMAUREX')).toBe(false);
  });
});

describe('parseBudgetAmount', () => {
  it('parses Swiss/EU formats', () => {
    expect(parseBudgetAmount('12,50')).toBe(12.5);
    expect(parseBudgetAmount("1'200")).toBe(1200);
    expect(parseBudgetAmount('1200.50')).toBe(1200.5);
  });
});

describe('buildProfitability', () => {
  it('subtracts all expenses from revenue', () => {
    const p = buildProfitability(
      [{ date: '2026-07-01', amount: 1000 }],
      [
        { date: '2026-07-02', amount: 200, category: 'SUPPLIERS' },
        { date: '2026-07-03', amount: 100, category: 'BILLS' },
        { date: '2026-07-04', amount: 150, category: 'PAYROLL' },
      ],
      '2026-07-01',
      '2026-07-31'
    );
    expect(p.cogs).toBe(200);
    expect(p.operating).toBe(100);
    expect(p.payroll).toBe(150);
    expect(p.totalExpenses).toBe(450);
    expect(p.netProfit).toBe(550);
    expect(p.marginPct).toBeCloseTo(55, 5);
  });
});
