/**
 * Parse Swiss SME chart of accounts text export (Plan comptable CH.pdf → text).
 *
 * Usage:
 *   node scripts/build-swiss-coa.mjs "shared/data/plan-comptable-ch.txt"
 *   node scripts/build-swiss-coa.mjs "C:/path/Plan comptable CH.pdf"
 *     (uses sibling .txt or shared/data/plan-comptable-ch.txt when given a PDF)
 */
import fs from "fs";
import path from "path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/build-swiss-coa.mjs <pdf-or-txt-path>");
  process.exit(1);
}

function readTextSource(filePath) {
  const abs = path.resolve(filePath);
  const buf = fs.readFileSync(abs);
  if (buf.slice(0, 5).toString() !== "%PDF-") {
    return buf.toString("utf8");
  }

  const candidates = [
    abs.replace(/\.pdf$/i, ".txt"),
    path.join(process.cwd(), "shared", "data", "plan-comptable-ch.txt"),
  ];
  for (const txtPath of candidates) {
    if (fs.existsSync(txtPath)) {
      console.log(`PDF input → using text extract: ${txtPath}`);
      return fs.readFileSync(txtPath, "utf8");
    }
  }

  console.error(
    "PDF is binary; provide a .txt text extract (same basename) or shared/data/plan-comptable-ch.txt",
  );
  process.exit(1);
}

const raw = readTextSource(inputPath);
const lines = raw.split(/\r?\n/);

const SECTION_RE =
  /^(BILAN|ACTIFS|PASSIFS|COMPTE(?:\s+DE\s+PERTES)?|PRODUITS|CHARGES)\b/i;

const NOISE_RE =
  /^(Basis|Konten|Gruppe Konto|Plan comptable|--\s*\d+\s+of\s+\d+|^-\d+-$)/i;

const KONTO_RE = /^(\d{4}(?:\(\d+\))?(?:\.[EP])?|\d{4}A)\s+/;

const TAIL_RE = /\s+([1-4])\s+(\d{2,3})\s+CHF\s*$/;

function isNoise(line) {
  const t = line.trim();
  if (!t) return true;
  if (NOISE_RE.test(t)) return true;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/.test(t)) return true;
  if (/^-\d+-$/.test(t)) return true;
  return false;
}

function splitLabels(middle) {
  let labelFr = middle;
  let labelEn = middle;
  const enSplit = middle.match(/^(.+?)\s+([A-Z][A-Za-z0-9 ,\-\/\(\)'.&]+)$/);
  if (enSplit) {
    labelFr = enSplit[1].replace(/\s+A$/, "").trim();
    labelEn = enSplit[2].replace(/\s+A$/, "").replace(/^A\s+/, "").trim();
  }
  return { labelFr, labelEn };
}

function parseAccountRow(text, currentSection) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const tail = trimmed.match(TAIL_RE);
  if (!tail) return null;

  const body = trimmed.slice(0, tail.index);
  const kontoMatch = body.match(KONTO_RE);
  if (!kontoMatch) return null;

  const konto = kontoMatch[1];
  const middle = body.slice(kontoMatch[0].length).trim();
  const { labelFr, labelEn } = splitLabels(middle);

  return {
    konto,
    group: tail[2],
    labelFr,
    labelEn,
    section: currentSection,
    currency: "CHF",
  };
}

const entries = [];
let currentSection = "BILAN";
let buffer = "";

function flushBuffer() {
  if (!buffer) return;
  const entry = parseAccountRow(buffer, currentSection);
  if (entry) entries.push(entry);
  buffer = "";
}

for (const line of lines) {
  const trimmed = line.trim();
  if (isNoise(trimmed)) continue;

  if (SECTION_RE.test(trimmed)) {
    flushBuffer();
    const key = trimmed.match(SECTION_RE)[1].toUpperCase();
    if (key.startsWith("COMPTE")) currentSection = "COMPTE_DE_PERTES_ET_PROFITS";
    else currentSection = key;
    continue;
  }

  if (KONTO_RE.test(trimmed)) {
    flushBuffer();
    buffer = trimmed;
  } else if (buffer) {
    buffer += " " + trimmed;
  }

  if (buffer && TAIL_RE.test(buffer.replace(/\s+/g, " "))) {
    flushBuffer();
  }
}

flushBuffer();

const outPath = path.join(process.cwd(), "shared", "data", "swissChartOfAccounts.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Wrote ${entries.length} accounts → ${outPath}`);
