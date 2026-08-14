/**
 * Invert near-neutral ink (black wordmark, charcoal plates) to light,
 * keep brand red. Writes on-dark lockup + mark variants.
 *
 * Usage: node scripts/generate-on-dark-logo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const brandDir = path.join(root, "client/public/brand");
const pngOpt = { compressionLevel: 9, effort: 10 };

function invertNeutralsKeepRed(data) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a < 8) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const isBrandRed = sat > 0.32 && r > 140 && r > g + 35 && r > b + 35;
    if (isBrandRed) continue;
    out[i] = 255 - r;
    out[i + 1] = 255 - g;
    out[i + 2] = 255 - b;
  }
  return out;
}

async function invertPng(srcPath, destPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const inverted = invertNeutralsKeepRed(data);
  await sharp(inverted, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png(pngOpt)
    .toFile(destPath);
  return sharp(destPath).metadata();
}

const lockupSrc = path.join(brandDir, "paystack-lockup.png");
const markSrc = path.join(brandDir, "paystack-mark-master.png");
if (!fs.existsSync(lockupSrc) || !fs.existsSync(markSrc)) {
  throw new Error("Missing paystack-lockup.png or paystack-mark-master.png — run process-new-logo first.");
}

const lockupOnDark = path.join(brandDir, "paystack-lockup-on-dark.png");
const markOnDark = path.join(brandDir, "paystack-mark-on-dark.png");

const lm = await invertPng(lockupSrc, lockupOnDark);
const mm = await invertPng(markSrc, markOnDark);

await sharp(lockupOnDark)
  .resize({ height: 128, fit: "inside" })
  .png(pngOpt)
  .toFile(path.join(brandDir, "paystack-lockup-on-dark-128.png"));

await sharp(markOnDark)
  .resize(128, 128, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png(pngOpt)
  .toFile(path.join(brandDir, "paystack-mark-on-dark-128.png"));

console.log(
  JSON.stringify(
    {
      lockupOnDark: { w: lm.width, h: lm.height, alpha: lm.hasAlpha },
      markOnDark: { w: mm.width, h: mm.height, alpha: mm.hasAlpha },
    },
    null,
    2,
  ),
);
