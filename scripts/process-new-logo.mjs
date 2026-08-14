/**
 * One-shot: WhatsApp/JPEG logo → transparent lockup + mark icons.
 * Usage: node scripts/process-new-logo.mjs [source.png]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.resolve(process.argv[2] || path.join(root, "tmp-logo-source.png"));
const brandDir = path.join(root, "client/public/brand");
const pngOpt = { compressionLevel: 9, effort: 10 };

fs.mkdirSync(brandDir, { recursive: true });

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const thresh = 242;
const out = Buffer.alloc(w * h * 4);
let minX = w;
let minY = h;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const whiteness = Math.min(r, g, b);
    let a = 255;
    if (whiteness >= thresh) a = 0;
    else if (whiteness >= thresh - 20) {
      a = Math.round(255 * (1 - (whiteness - (thresh - 20)) / 20));
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a;
    if (a > 20) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = 24;
const left = Math.max(0, minX - pad);
const top = Math.max(0, minY - pad);
const width = Math.min(w - 1, maxX + pad) - left + 1;
const height = Math.min(h - 1, maxY + pad) - top + 1;

const fullTransparent = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toBuffer();

const lockup = await sharp(fullTransparent)
  .extract({ left, top, width, height })
  .png(pngOpt)
  .toBuffer();

await sharp(lockup).toFile(path.join(brandDir, "paystack-lockup.png"));
await sharp(lockup).toFile(path.join(brandDir, "paystack-final-logo.png"));
await sharp(lockup).resize({ height: 128, fit: "inside" }).png(pngOpt).toFile(path.join(brandDir, "paystack-lockup-128.png"));

// Icon ends before the white gap (~x 266 on 1024 source)
const gapStart = 266;
const iconLeft = Math.max(0, minX - 8);
const iconTop = Math.max(0, minY - 8);
const iconRight = Math.min(gapStart, maxX);
const iconBottom = Math.min(h - 1, maxY + 8);
const iconW = iconRight - iconLeft;
const iconH = iconBottom - iconTop;

const iconExtract = await sharp(fullTransparent)
  .extract({ left: iconLeft, top: iconTop, width: iconW, height: iconH })
  .png()
  .toBuffer();

const side = Math.max(iconW, iconH) + 24;
const resizedIcon = await sharp(iconExtract)
  .resize({
    width: side - 20,
    height: side - 20,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const markMasterPath = path.join(brandDir, "paystack-mark-master.png");
await sharp({
  create: {
    width: side,
    height: side,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: resizedIcon, gravity: "centre" }])
  .png(pngOpt)
  .toFile(markMasterPath);

for (const [name, size] of [
  ["paystack-mark-128.png", 128],
  ["paystack-icon-192.png", 192],
  ["paystack-icon-512.png", 512],
]) {
  await sharp(markMasterPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png(pngOpt)
    .toFile(path.join(brandDir, name));
}

const lm = await sharp(path.join(brandDir, "paystack-lockup.png")).metadata();
const mm = await sharp(markMasterPath).metadata();
console.log(
  JSON.stringify(
    {
      source: src,
      lockup: { w: lm.width, h: lm.height, alpha: lm.hasAlpha },
      mark: { w: mm.width, h: mm.height, alpha: mm.hasAlpha },
    },
    null,
    2,
  ),
);
