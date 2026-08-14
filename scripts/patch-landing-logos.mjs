/**
 * Overlay the on-dark PayStack lockup onto landing product screenshots.
 * Reads existing v4 JPEGs (or tmp-landing-v3 PNGs) and writes v5 cache-busted files.
 *
 * Usage: node scripts/patch-landing-logos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const lockupDark = path.join(root, "client/public/brand/paystack-lockup-on-dark-128.png");
const lockupLight = path.join(root, "client/public/brand/paystack-lockup-128.png");
const landingDir = path.join(root, "client/public/landing");
const tmpDir = path.join(root, "tmp-landing-v3");

const jobs = [
  {
    sources: ["dashboard.png", "screenshot-dashboard-v4.jpg"],
    out: "screenshot-dashboard-v5.jpg",
    variant: "dark",
  },
  {
    sources: ["revenue.png", "screenshot-revenue-v4.jpg"],
    out: "screenshot-revenue-v5.jpg",
    variant: "dark",
  },
  {
    sources: ["expenses.png", "screenshot-expenses-v4.jpg"],
    out: "screenshot-expenses-v5.jpg",
    variant: "dark",
  },
  {
    sources: ["reports.png", "screenshot-reports-v4.jpg"],
    out: "screenshot-reports-v5.jpg",
    variant: "dark",
  },
  {
    sources: ["documents.png", "screenshot-documents-v4.jpg"],
    out: "screenshot-documents-v5.jpg",
    variant: "dark",
  },
  {
    sources: ["personal.png", "screenshot-personal-v4.jpg"],
    out: "screenshot-personal-v5.jpg",
    variant: "light",
  },
];

function resolveSrc(job) {
  for (const name of job.sources) {
    const tmp = path.join(tmpDir, name);
    if (fs.existsSync(tmp)) return tmp;
    const landing = path.join(landingDir, name);
    if (fs.existsSync(landing)) return landing;
  }
  return null;
}

async function samplePixel(imgPath, x, y) {
  const { data } = await sharp(imgPath)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], alpha: 255 };
}

/**
 * Cover the top-left brand strip (icon + wordmark) then place the lockup.
 * Sidebar on 1536×1024 shots is ~220–260px wide; brand row is ~y 12–78.
 */
async function patch(srcPath, outPath, variant) {
  const meta = await sharp(srcPath).metadata();
  const w = meta.width || 1536;
  const scale = w / 1536;
  const left = Math.round(14 * scale);
  const top = Math.round(14 * scale);
  const coverW = Math.round(210 * scale);
  const coverH = Math.round(62 * scale);
  const bg = await samplePixel(srcPath, Math.max(0, left - 4), top + 8);

  const cover = await sharp({
    create: { width: coverW, height: coverH, channels: 4, background: bg },
  })
    .png()
    .toBuffer();

  const lockupH = Math.round(36 * scale);
  const lockup = await sharp(variant === "light" ? lockupLight : lockupDark)
    .resize({ height: lockupH, fit: "inside" })
    .png()
    .toBuffer();
  const lockupMeta = await sharp(lockup).metadata();
  const lockupW = lockupMeta.width || coverW;
  const lockupLeft = Math.round(6 * scale);
  const lockupTop = Math.round((coverH - lockupH) / 2);

  const branded = await sharp(cover)
    .composite([
      {
        input: lockup,
        left: Math.min(lockupLeft, Math.max(0, coverW - lockupW - 4)),
        top: Math.max(0, lockupTop),
      },
    ])
    .png()
    .toBuffer();

  await sharp(srcPath)
    .composite([{ input: branded, left, top }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath);

  const outMeta = await sharp(outPath).metadata();
  console.log("wrote", path.basename(outPath), outMeta.width, outMeta.height);
}

for (const job of jobs) {
  const src = resolveSrc(job);
  if (!src) {
    console.warn("skip missing", job.out);
    continue;
  }
  console.log("src", path.relative(root, src), "→", job.out, job.variant);
  await patch(src, path.join(landingDir, job.out), job.variant);
}

console.log("done");
