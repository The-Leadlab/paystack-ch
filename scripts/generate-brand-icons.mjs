/**
 * Regenerate resized brand PNGs from client/public/brand/paystack-final-logo.png
 * Run: node scripts/generate-brand-icons.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "client/public/brand/paystack-final-logo.png");
const outDir = path.join(root, "client/public/brand");

const png = { compressionLevel: 9, effort: 10 };

async function main() {
  const base = sharp(src).ensureAlpha();
  await base
    .clone()
    .resize(128, 128, { fit: "cover" })
    .png(png)
    .toFile(path.join(outDir, "paystack-mark-128.png"));
  await base
    .clone()
    .resize(192, 192, { fit: "cover" })
    .png(png)
    .toFile(path.join(outDir, "paystack-icon-192.png"));
  await base
    .clone()
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(png)
    .toFile(path.join(outDir, "paystack-icon-512.png"));
}

await main();
