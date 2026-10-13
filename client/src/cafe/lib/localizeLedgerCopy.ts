/** Localize ledger category codes and known English payroll description prefixes. */

import { EXPENSE_CAT_KEYS } from '../i18n/expenseCategoryI18n';

const LEDGER_KEYS = [
  'SALES',
  'RESERVATION',
  'BILLS',
  'SUPPLIERS',
  'PAYROLL',
  'PAYROLL_TAXES',
  'OTHER',
] as const;

type TFn = (key: string) => string;

function fill(template: string, params: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

/** Translate income type / expense category codes (SALES → Ventes, FOOD_SUPPLIES → …). */
export function localizeLedgerCategory(raw: string | undefined, t: TFn): string {
  if (!raw) return '';
  const code = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if ((LEDGER_KEYS as readonly string[]).includes(code)) return t(code);
  const fineKey = EXPENSE_CAT_KEYS[code];
  if (fineKey) {
    const labeled = t(fineKey);
    if (labeled && labeled !== fineKey) return labeled;
  }
  const translated = t(code);
  return translated !== code ? translated : raw;
}

/**
 * Translate known system-written English descriptions (payslips) for display.
 * Leaves user-entered text unchanged.
 */
export function localizeLedgerDescription(raw: string | undefined, t: TFn): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  let m = trimmed.match(/^Payslip — salary payment to employee - (.+)$/i);
  if (m) return fill(t('payslipDescSalaryToEmployee'), { name: m[1] });

  m = trimmed.match(/^Payslip - (.+)$/i);
  if (m && !trimmed.includes('2nd payment') && !trimmed.includes('gross paid')) {
    return fill(t('payslipDescShort'), { name: m[1] });
  }

  m = trimmed.match(/^Payslip \(gross paid to employee\) - (.+)$/i);
  if (m) return fill(t('payslipDescGrossToEmployee'), { name: m[1] });

  m = trimmed.match(
    /^Payslip — 2nd payment: taxes & contributions to state \(gross − employee payment\) - (.+)$/i
  );
  if (m) return fill(t('payslipDescStatePayment'), { name: m[1] });

  return trimmed;
}

/** Apply `{token}` replacements; also localize `{cat}` when it is a ledger key. */
export function formatInsightText(
  templateKey: string,
  t: TFn,
  params?: Record<string, string>
): string {
  let text = t(templateKey);
  if (!params) return text;
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    resolved[k] = k === 'cat' ? localizeLedgerCategory(v, t) : v;
  }
  return fill(text, resolved);
}
