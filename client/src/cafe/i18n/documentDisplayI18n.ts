const INVOICES_DETECTED_RE = /^(\d+)\s+invoices detected$/i;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** Parse stored "N invoices detected" issuer labels. */
export function parseInvoicesDetectedCount(issuer: string | undefined): number | null {
  if (!issuer) return null;
  const m = issuer.match(INVOICES_DETECTED_RE);
  return m ? Number(m[1]) : null;
}

/** Strip extension for a readable document title. */
export function documentDisplayName(fileName: string | undefined, fallback = ''): string {
  if (!fileName?.trim()) return fallback;
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName.trim();
}

/**
 * Primary label for entity cards / headers.
 * Multi-invoice PDFs used to show "N invoices detected" — prefer the file name instead.
 */
export function formatIssuerForDisplay(
  issuer: string | undefined,
  t: (key: string) => string,
  opts?: { fileName?: string }
): string {
  if (!issuer) return opts?.fileName ? documentDisplayName(opts.fileName) : '';
  const count = parseInvoicesDetectedCount(issuer);
  if (count != null) {
    if (opts?.fileName) return documentDisplayName(opts.fileName);
    return t('dpMultiInvoiceDocument');
  }
  return issuer;
}

/** Small subtitle: "2 conjoined invoices". */
export function conjoinedInvoicesLabel(count: number, t: (key: string) => string): string {
  return t('dpConjoinedInvoices').replace('{n}', String(count));
}

export function invoicesDetectedIssuer(count: number, t: (key: string) => string): string {
  return conjoinedInvoicesLabel(count, t);
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
