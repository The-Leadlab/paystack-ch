#!/usr/bin/env node
/**
 * Fails if a file uses `.toLocaleString(chfLocale` without defining chfLocale
 * via useChfLocale(), useFormatChf(), or a local `const chfLocale =` assignment.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'client', 'src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

function checkFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('toLocaleString(chfLocale')) return [];

  const lines = text.split(/\r?\n/);
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('toLocaleString(chfLocale')) continue;

    const before = lines.slice(0, i + 1).join('\n');
    const hasHook =
      /\buseChfLocale\s*\(/.test(before) ||
      /\buseFormatChf\s*\(/.test(before) ||
      /\bconst\s+chfLocale\s*=/.test(before) ||
      /\blet\s+chfLocale\s*=/.test(before);

    if (!hasHook) {
      issues.push({ line: i + 1, rel: path.relative(ROOT, filePath) });
    }
  }

  return issues;
}

const allIssues = [];
for (const file of walk(SRC)) {
  allIssues.push(...checkFile(file));
}

if (allIssues.length === 0) {
  console.log('OK — every chfLocale toLocaleString use has a locale source in scope.');
  process.exit(0);
}

console.error('chfLocale scope check failed:\n');
for (const { rel, line } of allIssues) {
  console.error(`  ${rel}:${line} — use useChfLocale() or useFormatChf() in this component`);
}
process.exit(1);
