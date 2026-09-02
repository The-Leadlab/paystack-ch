#!/usr/bin/env node
/**
 * Verifies en/fr translation keys stay in sync.
 * Usage: node scripts/i18n-key-parity.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function keysFromObjectLiteral(block) {
  return [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
}

function compare(label, enKeys, frKeys) {
  const enSet = new Set(enKeys);
  const frSet = new Set(frKeys);
  const onlyEn = enKeys.filter((k) => !frSet.has(k));
  const onlyFr = frKeys.filter((k) => !enSet.has(k));
  console.log(`${label}: en=${enKeys.length} fr=${frKeys.length}`);
  let bad = false;
  if (onlyEn.length) {
    console.error(`  Keys only in en: ${onlyEn.join(", ")}`);
    bad = true;
  }
  if (onlyFr.length) {
    console.error(`  Keys only in fr: ${onlyFr.join(", ")}`);
    bad = true;
  }
  if (!bad) console.log("  OK — en/fr key sets match.");
  return !bad;
}

function extractExportRecord(source, exportName) {
  const re = new RegExp(`export const ${exportName}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`);
  const m = source.match(re);
  return m?.[1] ?? "";
}

let ok = true;

const ctx = fs.readFileSync(path.join(root, "client/src/cafe/context/LanguageContext.tsx"), "utf8");
function extractLangContextBlock(source, which) {
  const normalized = source.replace(/\r\n/g, "\n");
  if (which === "en") {
    const start = normalized.indexOf("\n  en: {");
    const end = normalized.indexOf("\n  fr: {", start + 1);
    if (start < 0 || end < 0) return "";
    return normalized.slice(start + "\n  en: {".length, end);
  }
  const start = normalized.indexOf("\n  fr: {");
  const end = normalized.search(/\n\};\s*\nconst LanguageContext/);
  if (start < 0 || end < 0) return "";
  return normalized.slice(start + "\n  fr: {".length, end).replace(/\n  \},\s*$/, "");
}

ok = compare(
  "LanguageContext",
  keysFromObjectLiteral(extractLangContextBlock(ctx, "en")),
  keysFromObjectLiteral(extractLangContextBlock(ctx, "fr"))
) && ok;

const dash = fs.readFileSync(path.join(root, "client/src/cafe/i18n/dashboardTranslations.ts"), "utf8");
ok =
  compare(
    "dashboardTranslations",
    keysFromObjectLiteral(extractExportRecord(dash, "dashboardEn")),
    keysFromObjectLiteral(extractExportRecord(dash, "dashboardFr"))
  ) && ok;

const tour = fs.readFileSync(path.join(root, "client/src/cafe/i18n/tourTranslations.ts"), "utf8");
ok =
  compare(
    "tourTranslations",
    keysFromObjectLiteral(extractExportRecord(tour, "tourEn")),
    keysFromObjectLiteral(extractExportRecord(tour, "tourFr"))
  ) && ok;

if (!ok) process.exit(1);
console.log("OK — all translation tables match.");
