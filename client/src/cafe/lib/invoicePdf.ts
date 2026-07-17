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

function wrapTextByParagraph(text: string, maxChars: number): string[] {
  return text.split(/\r?\n/).flatMap((paragraph) => wrapText(paragraph, maxChars));
}

type PdfCommand = {
  type: 'text';
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  text: string;
  wordSpacing?: number;
};

type PdfImage = {
  data: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  displayWidth: number;
  displayHeight: number;
  x: number;
  y: number;
};

const encoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pdfBytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function buildPdf(commands: PdfCommand[], logo?: PdfImage): Blob {
  const contentLines: string[] = [];
  if (logo) {
    contentLines.push(
      `q ${logo.displayWidth.toFixed(2)} 0 0 ${logo.displayHeight.toFixed(2)} ${logo.x.toFixed(2)} ${logo.y.toFixed(2)} cm /Logo Do Q`
    );
  }
  contentLines.push('BT');
  for (const cmd of commands) {
    const font = cmd.bold ? '/F2' : '/F1';
    contentLines.push(`${font} ${cmd.size} Tf`);
    contentLines.push(`1 0 0 1 ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} Tm`);
    contentLines.push(`${(cmd.wordSpacing ?? 0).toFixed(3)} Tw`);
    contentLines.push(`(${escapePdfText(cmd.text)}) Tj`);
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const streamBytes = pdfBytes(stream);
  const resources = logo ? ' /XObject << /Logo 7 0 R >>' : '';
  const objects: Uint8Array[] = [
    pdfBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    pdfBytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    pdfBytes(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${resources} >> >>\nendobj\n`
    ),
    concatBytes([
      pdfBytes(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      pdfBytes('\nendstream\nendobj\n'),
    ]),
    pdfBytes('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'),
    pdfBytes('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'),
  ];
  if (logo) {
    objects.push(
      concatBytes([
        pdfBytes(
          `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.pixelWidth} /Height ${logo.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n`
        ),
        logo.data,
        pdfBytes('\nendstream\nendobj\n'),
      ])
    );
  }

  const header = pdfBytes('%PDF-1.4\n');
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let length = header.length;
  for (const object of objects) {
    offsets.push(length);
    parts.push(object);
    length += object.length;
  }

  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`,
    `startxref\n${length}\n%%EOF`,
  ].join('');
  parts.push(pdfBytes(xref));

  return new Blob([concatBytes(parts)], { type: 'application/pdf' });
}

async function dataUrlToPdfJpeg(dataUrl: string): Promise<PdfImage | undefined> {
  if (!/^data:image\/(?:jpeg|png);base64,/i.test(dataUrl)) return undefined;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to decode company logo.'));
    image.src = dataUrl;
  });

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, sourceWidth, sourceHeight);
  context.drawImage(image, 0, 0);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const base64 = jpegDataUrl.slice(jpegDataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const displayWidth = 80;
  const displayHeight = Math.min(56, (sourceHeight / sourceWidth) * displayWidth);
  return {
    data,
    pixelWidth: sourceWidth,
    pixelHeight: sourceHeight,
    displayWidth,
    displayHeight,
    x: MARGIN,
    y: PAGE_H - MARGIN - displayHeight,
  };
}

function estimateTextWidth(text: string, size: number): number {
  return text.length * size * 0.5;
}

function addJustifiedLines(
  cmds: PdfCommand[],
  lines: string[],
  x: number,
  y: number,
  size: number,
  width: number,
  lineHeight: number
): void {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const gaps = line.trim().split(/\s+/).length - 1;
    const isFinalLine = index === lines.length - 1;
    const wordSpacing = !isFinalLine && gaps > 0 ? Math.max(0, (width - estimateTextWidth(line, size)) / gaps) : 0;
    cmds.push({ type: 'text', x, y, size, text: line, wordSpacing });
    y -= lineHeight;
  }
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
  const lines = wrapTextByParagraph(text, maxChars);
  for (const line of lines) {
    cmds.push({ type: 'text', x, y, size, bold, text: line });
    y -= lineHeight;
  }
  return y;
}

export async function buildInvoicePdfBlob(
  invoice: InvoiceData,
  labels: InvoicePdfLabels,
  locale: string,
  companyLogoDataUrl?: string
): Promise<Blob> {
  const logoDataUrl = companyLogoDataUrl ?? invoice.companyLogoDataUrl;
  const logo = logoDataUrl ? await dataUrlToPdfJpeg(logoDataUrl) : undefined;
  const cmds: PdfCommand[] = [];
  let y = PAGE_H - MARGIN;

  const titleX = logo ? MARGIN + 96 : MARGIN;
  cmds.push({ type: 'text', x: titleX, y, size: 20, bold: true, text: labels.previewTitle });
  y -= 28;
  cmds.push({ type: 'text', x: titleX, y, size: 9, bold: false, text: labels.invoiceNumber });
  cmds.push({ type: 'text', x: titleX + 110, y, size: 11, bold: true, text: invoice.invoiceNumber });
  y -= 14;
  cmds.push({
    type: 'text',
    x: titleX,
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

  const termLines = invoice.terms ? wrapTextByParagraph(invoice.terms, 96).slice(0, 7) : [];
  const termsTitleY = MARGIN + termLines.length * 11 + 12;
  const contentFloor = invoice.terms ? termsTitleY + 92 : 140;

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
    if (y < contentFloor) break;
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

  if (invoice.notes && y > termsTitleY + 24) {
    cmds.push({ type: 'text', x: MARGIN, y, size: 9, bold: true, text: labels.notes });
    const availableNoteLines = Math.max(0, Math.floor((y - termsTitleY - 24) / 12));
    y = addLines(cmds, wrapTextByParagraph(invoice.notes, 90).slice(0, availableNoteLines).join('\n'), MARGIN, y - 12, 9, false, 90, 12);
    y -= 6;
  }
  if (termLines.length > 0) {
    cmds.push({ type: 'text', x: MARGIN, y: termsTitleY, size: 9, bold: true, text: labels.terms });
    addJustifiedLines(cmds, termLines, MARGIN, termsTitleY - 12, 8.5, 595 - MARGIN * 2, 11);
  }

  return buildPdf(cmds, logo);
}

export async function downloadInvoicePdf(
  invoice: InvoiceData,
  labels: InvoicePdfLabels,
  locale: string,
  companyLogoDataUrl?: string
): Promise<void> {
  const blob = await buildInvoicePdfBlob(invoice, labels, locale, companyLogoDataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoiceNumber.replace(/[^\w.-]+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
