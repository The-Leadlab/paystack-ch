const INVOICES_DETECTED_RE = /^(\d+)\s+invoices detected$/i;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** Stored issuer for multi-invoice PDFs (English canonical); translate for display. */
export function formatIssuerForDisplay(
  issuer: string | undefined,
  t: (key: string) => string
): string {
  if (!issuer) return '';
  const m = issuer.match(INVOICES_DETECTED_RE);
  if (m) return t('dpInvoicesDetected').replace('{n}', m[1]);
  return issuer;
}

export function invoicesDetectedIssuer(count: number, t: (key: string) => string): string {
  return t('dpInvoicesDetected').replace('{n}', String(count));
}

export function parseMonthKey(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.length < 7) return null;
  const month = dateStr.substring(0, 7);
  return MONTH_KEY_RE.test(month) ? month : null;
}

export function formatMonthYearLabel(
  month: string,
  locale: string,
  invalidLabel: string
): string {
  if (!MONTH_KEY_RE.test(month)) return invalidLabel;
  const d = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return invalidLabel;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
}
