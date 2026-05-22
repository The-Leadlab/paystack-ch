#!/usr/bin/env node
/**
 * Verifies en/fr translation keys in LanguageContext.tsx stay in sync.
 * Usage: node scripts/i18n-key-parity.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "client/src/cafe/context/LanguageContext.tsx");
const s = fs.readFileSync(file, "utf8");

const enBlock = s.match(/en:\s*\{([\s\S]*?)\n  \},\s*\n  fr:/)?.[1] ?? "";
const frBlock = s.match(/fr:\s*\{([\s\S]*?)\n  \},?\s*\n\};\s*\n\nconst LanguageContext/)?.[1] ?? "";

function keys(block) {
  return [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
}

const en = keys(enBlock);
const fr = keys(frBlock);
const enSet = new Set(en);
const frSet = new Set(fr);
const onlyEn = en.filter((k) => !frSet.has(k));
const onlyFr = fr.filter((k) => !enSet.has(k));

console.log(`LanguageContext: en=${en.length} fr=${fr.length}`);
if (onlyEn.length) {
  console.error("Keys only in en:", onlyEn.join(", "));
  process.exit(1);
}
if (onlyFr.length) {
  console.error("Keys only in fr:", onlyFr.join(", "));
  process.exit(1);
}
console.log("OK — en/fr key sets match.");
