/**
 * Patch sidebar brand mark on landing screenshots with the new diamond-stack logo.
 * Usage: node scripts/patch-landing-logos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const brandMark = path.join(root, "client/public/brand/paystack-mark-128.png");
const inDir = path.join(root, "tmp-landing-v3");
const outDir = path.join(root, "client/public/landing");

/** Approximate sidebar brand slot on 1536×1024 app chrome (dark sidebar). */
const SLOT = { left: 18, top: 18, width: 44, height: 44 };

/** Per-shot fallbacks when the old red-bar detector misses (icon already similar / light mark). */
const SLOT_BY_FILE = {
  "expenses.png": { left: 21, top: 27, width: 42, height: 42 },
  "documents.png": { left: 24, top: 28, width: 42, height: 42 },
  "personal.png": { left: 24, top: 36, width: 40, height: 40 },
};

const jobs = [
  { in: "dashboard.png", out: "screenshot-dashboard-v4.jpg" },
  { in: "revenue.png", out: "screenshot-revenue-v4.jpg" },
  { in: "expenses.png", out: "screenshot-expenses-v4.jpg" },
  { in: "reports.png", out: "screenshot-reports-v4.jpg" },
  { in: "documents.png", out: "screenshot-documents-v4.jpg" },
  { in: "personal.png", out: "screenshot-personal-v4.jpg" },
];

async function findRedBarCluster(imgPath) {
  const { data, info } = await sharp(imgPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  // Search top-left sidebar for strong red pixels (old three-bar mark)
  // Only the mark column — avoid wordmark / CTA red false positives
  const searchW = Math.min(70, w);
  const searchH = Math.min(90, h);
  let minX = searchW;
  let minY = searchH;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < searchH; y++) {
    for (let x = 0; x < searchW; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 160 && g < 90 && b < 90 && r - g > 60) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 40) return null;
  const pad = 4;
  const rawW = maxX - minX + 1 + pad * 2;
  const rawH = maxY - minY + 1 + pad * 2;
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(rawW, 48),
    height: Math.min(rawH, 48),
    count,
  };
}

async function sampleBg(imgPath, box) {
  const { data, info } = await sharp(imgPath)
    .extract({
      left: Math.max(0, box.left - 6),
      top: Math.max(0, box.top),
      width: 4,
      height: Math.min(8, box.height),
    })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  // average
  let r = 0;
  let g = 0;
  let b = 0;
  const n = info.width * info.height;
  for (let i = 0; i < n; i++) {
    r += data[i * 4];
    g += data[i * 4 + 1];
    b += data[i * 4 + 2];
  }
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
    alpha: 255,
  };
}

const markBuf = await sharp(brandMark)
  .resize(40, 40, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

for (const job of jobs) {
  const srcPath = path.join(inDir, job.in);
  if (!fs.existsSync(srcPath)) {
    console.warn("skip missing", job.in);
    continue;
  }
  const meta = await sharp(srcPath).metadata();
  let box = await findRedBarCluster(srcPath);
  if (!box) {
    box = SLOT_BY_FILE[job.in] ? { ...SLOT_BY_FILE[job.in] } : { ...SLOT };
    console.warn(job.in, "no red cluster — using", box);
  } else {
    console.log(job.in, "red cluster", box);
  }

  // Cover old mark with sidebar bg, then place new mark centered in that box
  const bg = await sampleBg(srcPath, box);
  const coverW = Math.max(box.width, 42);
  const coverH = Math.max(box.height, 42);
  const cover = await sharp({
    create: {
      width: coverW,
      height: coverH,
      channels: 4,
      background: bg,
    },
  })
    .png()
    .toBuffer();

  const markOnCover = await sharp(cover)
    .composite([
      {
        input: await sharp(brandMark)
          .resize(Math.min(coverW - 4, coverH - 4), Math.min(coverW - 4, coverH - 4), {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer(),
        gravity: "centre",
      },
    ])
    .png()
    .toBuffer();

  const outPath = path.join(outDir, job.out);
  await sharp(srcPath)
    .composite([{ input: markOnCover, left: box.left, top: box.top }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);
  const outMeta = await sharp(outPath).metadata();
  console.log("wrote", job.out, outMeta.width, outMeta.height, meta.format, "→ jpeg");
}

console.log("done");
