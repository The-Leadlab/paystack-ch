/**
 * Keep client/public/pdf.worker.min.mjs in sync with the installed pdfjs-dist version.
 * Production loads this same-origin path so PDF.js never 404s the worker.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(root, "client/public/pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.error("sync-pdf-worker: missing", src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("sync-pdf-worker: wrote", path.relative(root, dest));
