import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const lines = [
  "UBS Personal Account Statement",
  "Account: CH93 0076 2011 6238 5295 7",
  "Period: 01.07.2026 - 31.08.2026",
  "Currency: CHF",
  "",
  "Date        Description                    Amount",
  "01.07.2026  Salary ACME SA                 5200.00",
  "03.07.2026  Migros groceries                -86.40",
  "05.07.2026  Swisscom bill                   -69.90",
  "08.07.2026  Coop Lausanne                   -54.20",
  "10.07.2026  Rent loft Geneva              -1850.00",
  "12.07.2026  Serafe media fee                -25.00",
  "15.07.2026  Dividend Swissquote             120.50",
  "18.07.2026  Uber Eats                       -32.80",
  "22.07.2026  Pillar 3a VIAC                 -200.00",
  "28.07.2026  Family gift contribution        150.00",
  "01.08.2026  Salary ACME SA                 5200.00",
  "03.08.2026  Migros Ouchy                    -74.20",
  "04.08.2026  Coop Lausanne                   -92.10",
  "06.08.2026  Sunrise mobile                  -49.90",
  "08.08.2026  Swisscom bill                   -69.90",
  "10.08.2026  Rent loft Geneva              -1850.00",
  "12.08.2026  Gym Fitness Park                -79.00",
  "15.08.2026  Dividend Swissquote              95.00",
  "18.08.2026  Deliveroo dinner                -28.50",
  "22.08.2026  Pillar 3a VIAC                 -200.00",
  "25.08.2026  Amazon shopping                -119.90",
  "28.08.2026  Family gift contribution         80.00",
];

function escapePdfText(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const content = ["BT", "/F1 10 Tf", "40 800 Td", "12 TL"];
lines.forEach((line, i) => {
  if (i === 0) content.push(`(${escapePdfText(line)}) Tj`);
  else content.push(`T* (${escapePdfText(line)}) Tj`);
});
content.push("ET");
const stream = content.join("\n");
const objs = [];
objs.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
objs.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
objs.push(
  "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
);
objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`);
objs.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>endobj\n");

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const obj of objs) {
  offsets.push(Buffer.byteLength(pdf, "utf8"));
  pdf += obj;
}
const xrefStart = Buffer.byteLength(pdf, "utf8");
pdf += `xref\n0 ${objs.length + 1}\n`;
pdf += "0000000000 65535 f \n";
for (let i = 1; i <= objs.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

const outDir = path.join(root, "fixtures", "personal");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "ali-bank-statement-2026-07.pdf");
fs.writeFileSync(outPath, pdf);
console.log("Wrote", outPath, fs.statSync(outPath).size, "bytes");
