import type { ReportEmailCadence } from "../shared/reportPeriod.js";

export type ReportPdfLine = {
  date: string;
  label: string;
  amount: number;
  kind: "income" | "expense";
};

export type ReportPdfPayload = {
  cadence: ReportEmailCadence;
  periodLabel: string;
  sessionName: string;
  dateFrom: string;
  dateTo: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  vatReceived: number;
  vatPaid: number;
  lines: ReportPdfLine[];
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r/g, "");
}

function fmtChf(n: number): string {
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PdfCmd = { x: number; y: number; size: number; bold?: boolean; text: string };

function buildPdf(commands: PdfCmd[]): Buffer {
  const contentLines: string[] = ["BT"];
  for (const cmd of commands) {
    const font = cmd.bold ? "/F2" : "/F1";
    contentLines.push(`${font} ${cmd.size} Tf`);
    contentLines.push(`1 0 0 1 ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} Tm`);
    contentLines.push(`(${escapePdfText(cmd.text)}) Tj`);
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const streamLen = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function buildReportPdfBuffer(data: ReportPdfPayload): Buffer {
  const cmds: PdfCmd[] = [];
  let y = 800;

  const push = (text: string, size: number, bold = false, x = 48) => {
    cmds.push({ x, y, size, bold, text });
    y -= size + 6;
  };

  push("PAYSTACK FINANCIAL REPORT", 16, true);
  push(data.periodLabel, 11, true);
  push(`Session: ${data.sessionName}`, 9);
  push(`Period: ${data.dateFrom} to ${data.dateTo}`, 9);
  push(`Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, 8);
  y -= 8;

  push(`Total income: CHF ${fmtChf(data.totalIncome)}`, 10, true);
  push(`Total expenses: CHF ${fmtChf(data.totalExpenses)}`, 10, true);
  push(`Balance: CHF ${fmtChf(data.balance)}`, 11, true);
  push(`VAT received: CHF ${fmtChf(data.vatReceived)}`, 9);
  push(`VAT paid: CHF ${fmtChf(data.vatPaid)}`, 9);
  y -= 10;

  push("Transactions", 10, true);
  push("Date       Type      Amount CHF    Description", 8, true);

  const maxLines = 40;
  for (const line of data.lines.slice(0, maxLines)) {
    const prefix = line.kind === "income" ? "Income " : "Expense";
    const desc = line.label.slice(0, 42);
    push(
      `${line.date}  ${prefix.padEnd(8)}  ${fmtChf(line.amount).padStart(10)}  ${desc}`,
      8
    );
    if (y < 72) break;
  }

  if (data.lines.length > maxLines) {
    push(`… and ${data.lines.length - maxLines} more lines`, 8);
  }

  return buildPdf(cmds);
}
