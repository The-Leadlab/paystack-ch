/** CSV import for Revenue tab — Z-reading & Stripe-style exports. */

import type { ZReadingDraft } from './posZReading';

export type ImportDocType = 'z_reading' | 'stripe_statement';

export type CsvColumnDef = {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
  aliases: string[];
};

export const Z_READING_COLUMNS: CsvColumnDef[] = [
  {
    key: 'description',
    label: 'Description',
    required: true,
    aliases: ['desc', 'description', 'item', 'product'],
  },
  {
    key: 'payment_method',
    label: 'Payment method',
    required: true,
    aliases: ['method', 'pay', 'tender', 'type', 'payment'],
  },
  {
    key: 'amount',
    label: 'Amount (gross)',
    required: true,
    aliases: ['amount', 'gross', 'total', 'sales', 'revenue', 'value'],
  },
  {
    key: 'date',
    label: 'Date (optional)',
    required: false,
    hint: 'YYYY-MM-DD — else uses header date',
    aliases: ['date', 'day', 'occurred'],
  },
];

export const STRIPE_COLUMNS: CsvColumnDef[] = [
  {
    key: 'description',
    label: 'Description',
    required: true,
    aliases: ['desc', 'description', 'reporting_category', 'type', 'payout'],
  },
  {
    key: 'amount',
    label: 'Gross amount',
    required: true,
    aliases: ['gross', 'amount', 'sales'],
  },
  {
    key: 'fees',
    label: 'Fees (optional)',
    required: false,
    aliases: ['fee', 'fees', 'processing'],
  },
  {
    key: 'date',
    label: 'Date (optional)',
    required: false,
    aliases: ['date', 'created', 'available_on', 'arrival_date'],
  },
];

const PAYMENT_METHODS = [
  'cash',
  'visa',
  'mastercard',
  'amex',
  'twint',
  'apple_pay',
  'google_pay',
  'bank_transfer',
  'gift_card',
  'other',
] as const;

export type CsvParseIssue = { row: number; message: string };

export type CsvPreviewRow = {
  description: string;
  payment_method: string;
  amount: number;
  date?: string;
  fees?: number;
};

export type CsvPreview = {
  documentType: ImportDocType;
  date: string;
  currency: string;
  rows: CsvPreviewRow[];
  validRows: number;
  issues: CsvParseIssue[];
  totals: { gross: number; net: number; fees: number };
};

export function zReadingTemplateCsv(): string {
  return [
    'description,payment_method,amount,date',
    'Daily sales,card,1250.00,2026-07-27',
    'Daily sales,cash,430.50,2026-07-27',
    'Daily sales,twint,89.00,2026-07-27',
  ].join('\n');
}

export function stripeTemplateCsv(): string {
  return [
    'description,gross,fees,date',
    'Card payments,1250.00,32.50,2026-07-27',
    'TWINT,89.00,2.10,2026-07-27',
  ].join('\n');
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i += 1;
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

export function autoMapColumns(headers: string[], defs: CsvColumnDef[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const def of defs) {
    let idx = lower.findIndex((h) => h === def.key || h === def.label.toLowerCase());
    if (idx === -1) {
      idx = lower.findIndex((h) => def.aliases.some((a) => h.includes(a)));
    }
    if (idx !== -1) mapping[def.key] = idx;
  }
  return mapping;
}

function parseAmount(raw: string): number {
  if (!raw?.trim()) return NaN;
  let t = raw.trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[^\d.,\-]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, '');
  else if (t.includes(',') && !t.includes('.')) {
    t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  }
  const n = parseFloat(t);
  return neg ? -n : n;
}

export function normalizePaymentMethod(raw: string): string {
  const t = raw.toLowerCase().trim().replace(/[\s\-]+/g, '_');
  if (!t) return 'other';
  if (['cash', 'cash_sales', 'cashier', 'especes'].some((x) => t.includes(x))) return 'cash';
  if (t.includes('visa')) return 'visa';
  if (t.includes('master')) return 'mastercard';
  if (t.includes('amex') || t.includes('american')) return 'amex';
  if (t.includes('twint')) return 'twint';
  if (t.includes('apple')) return 'apple_pay';
  if (t.includes('google')) return 'google_pay';
  if (t.includes('bank') || t.includes('transfer') || t.includes('payout')) return 'bank_transfer';
  if (t.includes('gift')) return 'gift_card';
  if (t.includes('card') || t.includes('carte') || t.includes('debit')) return 'card';
  return (PAYMENT_METHODS as readonly string[]).includes(t) ? t : 'other';
}

export function previewCsvImport(opts: {
  kind: ImportDocType;
  matrix: string[][];
  mapping: Record<string, number>;
  headerDate: string;
  currency: string;
}): CsvPreview {
  const { kind, matrix, mapping, headerDate, currency } = opts;
  if (matrix.length < 2) {
    return {
      documentType: kind,
      date: headerDate,
      currency,
      rows: [],
      validRows: 0,
      issues: [{ row: 0, message: 'CSV needs a header row and at least one data row' }],
      totals: { gross: 0, net: 0, fees: 0 },
    };
  }

  const dataRows = matrix.slice(1);
  const rows: CsvPreviewRow[] = [];
  const issues: CsvParseIssue[] = [];

  dataRows.forEach((cells, i) => {
    const rowNum = i + 2;
    const get = (key: string) => {
      const idx = mapping[key];
      return idx == null ? '' : (cells[idx] ?? '').trim();
    };
    const description = get('description');
    if (!description) {
      issues.push({ row: rowNum, message: 'Missing description' });
      return;
    }
    const amount = parseAmount(get('amount'));
    if (!Number.isFinite(amount) || amount === 0) {
      issues.push({ row: rowNum, message: 'Amount is not a number' });
      return;
    }
    const pmRaw = kind === 'z_reading' ? get('payment_method') : 'card';
    if (kind === 'z_reading' && !pmRaw) {
      issues.push({ row: rowNum, message: 'Missing payment method' });
      return;
    }
    const fees = parseAmount(get('fees'));
    rows.push({
      description,
      payment_method: normalizePaymentMethod(pmRaw || 'card'),
      amount,
      date: get('date') || headerDate,
      fees: Number.isFinite(fees) ? fees : undefined,
    });
  });

  const gross = rows.reduce((s, r) => s + r.amount, 0);
  const fees = rows.reduce((s, r) => s + (r.fees || 0), 0);

  return {
    documentType: kind,
    date: headerDate,
    currency,
    rows,
    validRows: rows.length,
    issues,
    totals: { gross, net: gross - fees, fees },
  };
}

export function csvPreviewToZReadingDraft(preview: CsvPreview, fallbackDate: string): ZReadingDraft {
  let cash = 0;
  let card = 0;
  let other = 0;
  for (const row of preview.rows) {
    const m = row.payment_method;
    if (m === 'cash') cash += row.amount;
    else if (['visa', 'mastercard', 'amex', 'card'].includes(m)) card += row.amount;
    else other += row.amount;
  }
  const gross = preview.totals.gross;
  const vatRate = 8.1 / 100;
  const vat = gross * (vatRate / (1 + vatRate));
  const net = gross - vat;
  const date =
    preview.rows.find((r) => r.date)?.date || preview.date || fallbackDate;

  return {
    date,
    gross_sales: round2(gross),
    net_sales: round2(net),
    vat_amount: round2(vat),
    cash: round2(cash),
    card: round2(card),
    other_payment: round2(other),
    tips: 0,
    discounts: 0,
    refunds: 0,
    notes: `Imported ${preview.validRows} CSV row(s) · ${preview.documentType.replace(/_/g, ' ')}`,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function missingRequiredColumns(
  mapping: Record<string, number>,
  defs: CsvColumnDef[]
): CsvColumnDef[] {
  return defs.filter((d) => d.required && mapping[d.key] == null);
}
