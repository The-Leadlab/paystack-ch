/**
 * Crush soft alpha + kill dark/light fringe halos on brand lockups.
 * Fixes the “ghost / double logo” look on dark and light chrome.
 *
 * Usage: node scripts/harden-brand-lockups.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const brandDir = path.join(root, "client/public/brand");
const pngOpt = { compressionLevel: 9, effort: 10, palette: false };

function isBrandRed(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat > 0.28 && r > 130 && r > g + 30 && r > b + 30;
}

/** @param {'dark' | 'light'} variant */
function harden(data, variant) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    let a = out[i + 3];
    if (a < 8) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const luma = (r + g + b) / 3;

    // Hard alpha — kills JPEG/anti-alias rings that read as a second wordmark
    if (a < 110) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    out[i + 3] = 255;

    if (isBrandRed(r, g, b)) continue;

    if (variant === "dark") {
      // On-dark: kill charcoal fringe under white letters (not icon plates ~80+)
      if (luma < 72) {
        out[i + 3] = 0;
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
      }
    } else {
      // On-light: kill near-white haze behind black wordmark
      if (luma > 232) {
        out[i + 3] = 0;
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
      }
    }
  }
  return out;
}

async function hardenFile(rel, variant) {
  const srcPath = path.join(brandDir, rel);
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cleaned = harden(data, variant);
  await sharp(cleaned, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png(pngOpt)
    .toFile(srcPath);
  const soft = cleaned.reduce((n, _, i) => {
    if (i % 4 !== 3) return n;
    const a = cleaned[i];
    return n + (a > 0 && a < 255 ? 1 : 0);
  }, 0);
  console.log("hardened", rel, info.width, info.height, "softAlphaLeft", soft);
}

const files = [
  ["paystack-lockup.png", "light"],
  ["paystack-lockup-128.png", "light"],
  ["paystack-final-logo.png", "light"],
  ["paystack-mark-master.png", "light"],
  ["paystack-mark-128.png", "light"],
  ["paystack-lockup-on-dark.png", "dark"],
  ["paystack-lockup-on-dark-128.png", "dark"],
  ["paystack-mark-on-dark.png", "dark"],
  ["paystack-mark-on-dark-128.png", "dark"],
];

for (const [rel, variant] of files) {
  await hardenFile(rel, variant);
}

console.log("done");
