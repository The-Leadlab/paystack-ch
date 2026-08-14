/**
 * Rebuild landing product screenshots with a single clean PayStack lockup.
 *
 * Starts from clean `tmp-landing-v3/*.png` (preferred) or prior JPGs.
 * Paints an opaque sidebar-colored plate over the entire old brand block
 * (icon + wordmark + “BUSINESS APP V3” / ghost layers), then composites
 * ONE hardened lockup sized like the live `/app` sidebar (`h-8` ≈ 32–36px).
 * Also updates the dashboard upload hint to match live CSV support.
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
const OUT_VER = "v7";

/**
 * Cover boxes tuned so we erase the old mark + wordmark + subtitle without
 * eating the first nav row. Coordinates are for 1536×1024 sources.
 */
const jobs = [
  {
    sources: ["dashboard.png"],
    out: `screenshot-dashboard-${OUT_VER}.jpg`,
    variant: "dark",
    cover: { left: 0, top: 0, width: 280, height: 100 },
    lockupH: 34,
    lockupPadX: 14,
    uploadHint: true,
  },
  {
    sources: ["revenue.png"],
    out: `screenshot-revenue-${OUT_VER}.jpg`,
    variant: "dark",
    cover: { left: 0, top: 0, width: 280, height: 100 },
    lockupH: 34,
    lockupPadX: 14,
  },
  {
    sources: ["expenses.png"],
    out: `screenshot-expenses-${OUT_VER}.jpg`,
    variant: "dark",
    cover: { left: 0, top: 0, width: 270, height: 100 },
    lockupH: 34,
    lockupPadX: 14,
  },
  {
    sources: ["reports.png"],
    out: `screenshot-reports-${OUT_VER}.jpg`,
    variant: "dark",
    cover: { left: 0, top: 0, width: 270, height: 100 },
    lockupH: 34,
    lockupPadX: 14,
  },
  {
    sources: ["documents.png"],
    out: `screenshot-documents-${OUT_VER}.jpg`,
    variant: "dark",
    cover: { left: 0, top: 0, width: 280, height: 92 },
    lockupH: 34,
    lockupPadX: 14,
  },
  {
    sources: ["personal.png"],
    out: `screenshot-personal-${OUT_VER}.jpg`,
    variant: "light",
    cover: { left: 0, top: 8, width: 260, height: 72 },
    lockupH: 32,
    lockupPadX: 18,
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

function isBrandRed(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat > 0.28 && r > 130 && r > g + 30 && r > b + 30;
}

/** Flatten lockup onto plate color so no fringe can show through. */
async function flattenLockup(lockupPath, height, plateBg, variant) {
  const resized = await sharp(lockupPath)
    .resize({ height, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i += 4) {
    let a = data[i + 3];
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = (r + g + b) / 3;

    if (a < 110) {
      // plate shows through
      out[i] = plateBg.r;
      out[i + 1] = plateBg.g;
      out[i + 2] = plateBg.b;
      out[i + 3] = 255;
      continue;
    }

    let useR = r;
    let useG = g;
    let useB = b;
    if (!isBrandRed(r, g, b)) {
      if (variant === "dark" && luma < 72) {
        useR = plateBg.r;
        useG = plateBg.g;
        useB = plateBg.b;
      } else if (variant === "light" && luma > 232) {
        useR = plateBg.r;
        useG = plateBg.g;
        useB = plateBg.b;
      }
    }

    // Premultiply soft edges against plate (after crush a is mostly 255)
    const t = a / 255;
    out[i] = Math.round(useR * t + plateBg.r * (1 - t));
    out[i + 1] = Math.round(useG * t + plateBg.g * (1 - t));
    out[i + 2] = Math.round(useB * t + plateBg.b * (1 - t));
    out[i + 3] = 255;
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function sampleBg(imgPath, cover, variant) {
  const fallback =
    variant === "light"
      ? { r: 249, g: 250, b: 251, alpha: 255 }
      : { r: 17, g: 17, b: 17, alpha: 255 };
  try {
    const probes = [
      [2, 2],
      [4, 4],
      [6, 6],
      [Math.max(2, cover.left + 2), Math.max(2, cover.top + 2)],
    ];
    const samples = [];
    for (const [x, y] of probes) {
      const { data } = await sharp(imgPath)
        .extract({ left: x, top: y, width: 1, height: 1 })
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat > 0.25 && r > 120) continue;
      if (max > 220) continue;
      samples.push([r, g, b]);
    }
    if (!samples.length) return fallback;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const s of samples) {
      r += s[0];
      g += s[1];
      b += s[2];
    }
    const n = samples.length;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), alpha: 255 };
  } catch {
    return fallback;
  }
}

async function uploadHintOverlay(scale) {
  // Cover old “DROP PDF / JPG / PNG FILES” glyphs (≈817–968 × 555–572) and paint live CSV copy.
  const left = Math.round(780 * scale);
  const top = Math.round(552 * scale);
  const boxW = Math.round(220 * scale);
  const boxH = Math.round(24 * scale);
  const fontSize = Math.max(11, Math.round(12 * scale));
  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${boxW}" height="${boxH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#11161c"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}"
    font-weight="600" letter-spacing="0.03em" fill="#e8e8e8">DROP PDF / JPG / PNG / CSV</text>
</svg>`);
  const overlay = await sharp(svg).png().toBuffer();
  return { input: overlay, left, top };
}

async function patch(job, srcPath, outPath) {
  const meta = await sharp(srcPath).metadata();
  const w = meta.width || 1536;
  const h = meta.height || 1024;
  const scale = w / 1536;
  const cover = {
    left: Math.round(job.cover.left * scale),
    top: Math.round(job.cover.top * scale),
    width: Math.round(job.cover.width * scale),
    height: Math.round(job.cover.height * scale),
  };
  const bg = await sampleBg(srcPath, cover, job.variant);

  const plate = await sharp({
    create: {
      width: cover.width,
      height: cover.height,
      channels: 4,
      background: bg,
    },
  })
    .png()
    .toBuffer();

  const lockupH = Math.round(job.lockupH * scale);
  const lockupPath = job.variant === "light" ? lockupLight : lockupDark;
  const lockupFlat = await flattenLockup(lockupPath, lockupH, bg, job.variant);
  const lm = await sharp(lockupFlat).metadata();
  const lockupW = lm.width || cover.width;
  const padX = Math.round(job.lockupPadX * scale);
  const padY = Math.max(0, Math.round((cover.height - lockupH) / 2));

  const branded = await sharp(plate)
    .composite([
      {
        input: lockupFlat,
        left: Math.min(padX, Math.max(0, cover.width - lockupW - 4)),
        top: padY,
      },
    ])
    .png()
    .toBuffer();

  const composites = [{ input: branded, left: cover.left, top: cover.top }];
  if (job.uploadHint) {
    composites.push(await uploadHintOverlay(scale));
  }

  const tmpOut = `${outPath}.tmp.jpg`;
  await sharp(srcPath)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(tmpOut);
  fs.renameSync(tmpOut, outPath);

  const outMeta = await sharp(outPath).metadata();
  console.log(
    "wrote",
    path.basename(outPath),
    outMeta.width,
    outMeta.height,
    "cover",
    cover,
    "lockupH",
    lockupH,
    "bg",
    bg,
  );
}

for (const job of jobs) {
  const src = resolveSrc(job);
  if (!src) {
    console.warn("skip missing", job.out);
    continue;
  }
  console.log("src", path.relative(root, src), "→", job.out, job.variant);
  await patch(job, src, path.join(landingDir, job.out));
}

console.log("done", OUT_VER);
