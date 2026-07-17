import type { InvoiceData } from '../types/invoice';

export type InvoicePdfLabels = {
  previewTitle: string;
  invoiceNumber: string;
  from: string;
  to: string;
  date: string;
  dueDate: string;
  paymentTerms: string;
  colDescription: string;
  colQty: string;
  colUnit: string;
  colDiscount: string;
  colVat: string;
  colTotal: string;
  subtotal: string;
  discount: string;
  tax: string;
  vatBreakdown: string;
  total: string;
  notes: string;
  terms: string;
  status: string;
};

const PAGE_H = 842;
const MARGIN = 48;

function fmtMoney(amount: number, symbol: string, locale: string): string {
  return `${symbol} ${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type PdfCommand = { type: 'text'; x: number; y: number; size: number; bold?: boolean; text: string };

function buildPdf(commands: PdfCommand[]): Blob {
  const contentLines: string[] = ['BT'];
  for (const cmd of commands) {
    const font = cmd.bold ? '/F2' : '/F1';
    contentLines.push(`${font} ${cmd.size} Tf`);
    contentLines.push(`1 0 0 1 ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} Tm`);
    contentLines.push(`(${escapePdfText(cmd.text)}) Tj`);
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const streamLen = new TextEncoder().encode(stream).length;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function addLines(
  cmds: PdfCommand[],
  text: string,
  x: number,
  y: number,
  size: number,
  bold: boolean,
  maxChars: number,
  lineHeight: number
): number {
  const lines = text.includes('\n') ? text.split('\n').flatMap((p) => wrapText(p, maxChars)) : wrapText(text, maxChars);
  for (const line of lines) {
    cmds.push({ type: 'text', x, y, size, bold, text: line });
    y -= lineHeight;
  }
  return y;
}

export function buildInvoicePdfBlob(
  invoice: InvoiceData,
  labels: InvoicePdfLabels,
  locale: string
): Blob {
  const cmds: PdfCommand[] = [];
  let y = PAGE_H - MARGIN;

  cmds.push({ type: 'text', x: MARGIN, y, size: 20, bold: true, text: labels.previewTitle });
  y -= 28;
  cmds.push({ type: 'text', x: MARGIN, y, size: 9, bold: false, text: labels.invoiceNumber });
  cmds.push({ type: 'text', x: MARGIN + 110, y, size: 11, bold: true, text: invoice.invoiceNumber });
  y -= 14;
  cmds.push({
    type: 'text',
    x: MARGIN,
    y,
    size: 8,
    bold: false,
    text: `${labels.status}: ${invoice.status.toUpperCase()}`,
  });
  y -= 24;

  const leftX = MARGIN;
  const rightX = 310;
  cmds.push({ type: 'text', x: leftX, y, size: 10, bold: true, text: labels.from });
  cmds.push({ type: 'text', x: rightX, y, size: 10, bold: true, text: labels.to });
  y -= 14;

  let yLeft = addLines(cmds, invoice.companyName, leftX, y, 10, true, 36, 13);
  yLeft = addLines(cmds, invoice.companyAddress, leftX, yLeft, 9, false, 36, 12);
  if (invoice.companyPhone) yLeft = addLines(cmds, invoice.companyPhone, leftX, yLeft, 9, false, 36, 12);
  if (invoice.companyEmail) yLeft = addLines(cmds, invoice.companyEmail, leftX, yLeft, 9, false, 36, 12);
  if (invoice.companyWebsite) yLeft = addLines(cmds, invoice.companyWebsite, leftX, yLeft, 9, false, 36, 12);

  let yRight = addLines(cmds, invoice.clientName, rightX, y, 10, true, 36, 13);
  if (invoice.clientCompany) yRight = addLines(cmds, invoice.clientCompany, rightX, yRight, 9, false, 36, 12);
  yRight = addLines(cmds, invoice.clientAddress, rightX, yRight, 9, false, 36, 12);
  if (invoice.clientPhone) yRight = addLines(cmds, invoice.clientPhone, rightX, yRight, 9, false, 36, 12);
  if (invoice.clientEmail) yRight = addLines(cmds, invoice.clientEmail, rightX, yRight, 9, false, 36, 12);

  y = Math.min(yLeft, yRight) - 18;

  cmds.push({ type: 'text', x: MARGIN, y, size: 8, bold: true, text: labels.date });
  cmds.push({ type: 'text', x: 210, y, size: 8, bold: true, text: labels.dueDate });
  cmds.push({ type: 'text', x: 380, y, size: 8, bold: true, text: labels.paymentTerms });
  y -= 12;
  cmds.push({ type: 'text', x: MARGIN, y, size: 9, bold: false, text: fmtDate(invoice.date, locale) });
  cmds.push({ type: 'text', x: 210, y, size: 9, bold: false, text: fmtDate(invoice.dueDate, locale) });
  cmds.push({ type: 'text', x: 380, y, size: 9, bold: false, text: invoice.paymentTerms });
  y -= 22;

  cmds.push({ type: 'text', x: MARGIN, y, size: 7, bold: true, text: labels.colDescription });
  cmds.push({ type: 'text', x: 230, y, size: 7, bold: true, text: labels.colQty });
  cmds.push({ type: 'text', x: 270, y, size: 7, bold: true, text: labels.colUnit });
  cmds.push({ type: 'text', x: 340, y, size: 7, bold: true, text: labels.colDiscount });
  cmds.push({ type: 'text', x: 400, y, size: 7, bold: true, text: labels.colVat });
  cmds.push({ type: 'text', x: 460, y, size: 7, bold: true, text: labels.colTotal });
  y -= 14;

  for (const item of invoice.items) {
    const descLines = wrapText(item.description, 32);
    cmds.push({ type: 'text', x: MARGIN, y, size: 8, bold: false, text: descLines[0] });
    cmds.push({ type: 'text', x: 230, y, size: 8, bold: false, text: String(item.quantity) });
    cmds.push({
      type: 'text',
      x: 270,
      y,
      size: 8,
      bold: false,
      text: fmtMoney(item.unitPrice, invoice.currencySymbol, locale),
    });
    cmds.push({
      type: 'text',
      x: 340,
      y,
      size: 8,
      bold: false,
      text: item.discountAmount > 0 ? `-${fmtMoney(item.discountAmount, invoice.currencySymbol, locale)}` : '—',
    });
    cmds.push({ type: 'text', x: 400, y, size: 8, bold: false, text: `${item.taxRate}%` });
    cmds.push({
      type: 'text',
      x: 460,
      y,
      size: 8,
      bold: false,
      text: fmtMoney(item.total, invoice.currencySymbol, locale),
    });
    y -= 12;
    for (let i = 1; i < descLines.length; i += 1) {
      cmds.push({ type: 'text', x: MARGIN, y, size: 8, bold: false, text: descLines[i] });
      y -= 12;
    }
    if (y < 140) break;
  }

  y -= 10;
  cmds.push({
    type: 'text',
    x: 340,
    y,
    size: 9,
    bold: false,
    text: `${labels.subtotal}: ${fmtMoney(invoice.subtotal, invoice.currencySymbol, locale)}`,
  });
  y -= 12;

  const breakdown = invoice.vatBreakdown ?? [];
  if (breakdown.length > 1) {
    for (const line of breakdown) {
      cmds.push({
        type: 'text',
        x: 340,
        y,
        size: 9,
        bold: false,
        text: `${labels.tax} (${line.ratePercent}%): ${fmtMoney(line.vatAmount, invoice.currencySymbol, locale)}`,
      });
      y -= 12;
    }
  } else {
    cmds.push({
      type: 'text',
      x: 340,
      y,
      size: 9,
      bold: false,
      text: `${labels.tax}: ${fmtMoney(invoice.taxAmount, invoice.currencySymbol, locale)}`,
    });
    y -= 12;
  }

  if (invoice.discountAmount > 0) {
    cmds.push({
      type: 'text',
      x: 340,
      y,
      size: 9,
      bold: false,
      text: `${labels.discount}: -${fmtMoney(invoice.discountAmount, invoice.currencySymbol, locale)}`,
    });
    y -= 12;
  }
  y -= 2;
  cmds.push({
    type: 'text',
    x: 340,
    y,
    size: 12,
    bold: true,
    text: `${labels.total}: ${fmtMoney(invoice.total, invoice.currencySymbol, locale)}`,
  });
  y -= 24;

  if (invoice.notes) {
    cmds.push({ type: 'text', x: MARGIN, y, size: 9, bold: true, text: labels.notes });
    y = addLines(cmds, invoice.notes, MARGIN, y - 12, 9, false, 90, 12);
    y -= 6;
  }
  if (invoice.terms) {
    cmds.push({ type: 'text', x: MARGIN, y, size: 9, bold: true, text: labels.terms });
    addLines(cmds, invoice.terms, MARGIN, y - 12, 9, false, 90, 12);
  }

  return buildPdf(cmds);
}

export async function downloadInvoicePdf(
  invoice: InvoiceData,
  labels: InvoicePdfLabels,
  locale: string
): Promise<void> {
  const blob = buildInvoicePdfBlob(invoice, labels, locale);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoiceNumber.replace(/[^\w.-]+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
