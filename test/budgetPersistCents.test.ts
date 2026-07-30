import { describe, expect, it } from 'vitest';
import { formatChfDisplay } from '../client/src/ali-lab/personal-plan/formatChfDisplay';
import { parseBudgetAmount } from '../client/src/ali-lab/lib/parseBudgetAmount';

describe('formatChfDisplay', () => {
  it('keeps centimes by default (1499.5 → 1’499.50, not 1’500)', () => {
    const s = formatChfDisplay(1499.5);
    expect(s).toContain('499.50');
    expect(s).not.toMatch(/1['\u2019]?500(?!\.)/);
  });

  it('still allows whole-franc display when asked', () => {
    expect(formatChfDisplay(1499.5, { decimals: false, prefix: false })).toMatch(/1['\u2019]?500/);
  });
});

describe('parseBudgetAmount for Expected budgets', () => {
  it('parses typed expected values', () => {
    expect(parseBudgetAmount('1000')).toBe(1000);
    expect(parseBudgetAmount('1499,50')).toBe(1499.5);
    expect(parseBudgetAmount("1'499.50")).toBe(1499.5);
  });
});
