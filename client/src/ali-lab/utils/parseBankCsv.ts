import type { LabCsvRow } from "../types";

function detectDelimiter(line: string): string {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/['\s]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function parseDate(raw: string): string {
  const t = raw.trim();
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/**
 * Heuristic CSV parser for PostFinance / UBS-style exports (semicolon or comma).
 */
export function parseBankCsv(text: string): LabCsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const delim = detectDelimiter(lines[0]);
  const header = lines[0].toLowerCase().split(delim).map((h) => h.trim());

  const dateIdx = header.findIndex((h) => /date|datum|data/.test(h));
  const descIdx = header.findIndex((h) => /text|description|buchung|libell|beneficiaire|details/.test(h));
  const amountIdx = header.findIndex((h) => /amount|betrag|montant|importo|credit|debit|belastung|gutschrift/.test(h));
  const debitIdx = header.findIndex((h) => /debit|belastung|soll|out/.test(h));
  const creditIdx = header.findIndex((h) => /credit|gutschrift|haben|in/.test(h));

  const rows: LabCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 2) continue;

    const description =
      descIdx >= 0 ? cols[descIdx] : cols.find((c) => c.length > 3) || "Transaction";
    const date = dateIdx >= 0 ? parseDate(cols[dateIdx]) : parseDate(cols[0]);

    let amount = 0;
    let flow: LabCsvRow["flow"] = "EXPENSE";

    if (debitIdx >= 0 && creditIdx >= 0) {
      const d = parseAmount(cols[debitIdx] || "0");
      const c = parseAmount(cols[creditIdx] || "0");
      if (c > 0 && d <= 0) {
        amount = c;
        flow = "INCOME";
      } else {
        amount = d || c;
        flow = d > 0 ? "EXPENSE" : "INCOME";
      }
    } else if (amountIdx >= 0) {
      const raw = cols[amountIdx];
      amount = parseAmount(raw);
      if (raw.includes("-")) flow = "EXPENSE";
      else if (/\+|gutschrift|credit/i.test(raw)) flow = "INCOME";
      else flow = amount >= 0 ? "INCOME" : "EXPENSE";
      amount = Math.abs(amount);
    } else {
      const last = cols[cols.length - 1];
      amount = parseAmount(last);
      flow = last.includes("-") ? "EXPENSE" : "INCOME";
    }

    if (amount <= 0) continue;
    rows.push({ date, description, amountChf: amount, flow });
  }

  return rows;
}
