/**
 * Regenerate resized brand PNGs from client/public/brand/paystack-mark-master.png
 * (fallback: paystack-final-logo.png). Run: node scripts/generate-brand-icons.mjs
 *
 * Prefer `node scripts/process-new-logo.mjs <source>` when replacing the master artwork
 * (removes white background + writes lockup + mark master).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "client/public/brand");
const markMaster = path.join(outDir, "paystack-mark-master.png");
const fallback = path.join(outDir, "paystack-final-logo.png");
const src = fs.existsSync(markMaster) ? markMaster : fallback;

const png = { compressionLevel: 9, effort: 10 };

async function main() {
  const base = sharp(src).ensureAlpha();
  await base
    .clone()
    .resize(128, 128, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png(png)
    .toFile(path.join(outDir, "paystack-mark-128.png"));
  await base
    .clone()
    .resize(192, 192, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png(png)
    .toFile(path.join(outDir, "paystack-icon-192.png"));
  await base
    .clone()
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png(png)
    .toFile(path.join(outDir, "paystack-icon-512.png"));

  const lockup = path.join(outDir, "paystack-lockup.png");
  if (fs.existsSync(lockup)) {
    await sharp(lockup)
      .resize({ height: 128, fit: "inside" })
      .png(png)
      .toFile(path.join(outDir, "paystack-lockup-128.png"));
  }

  const darkScript = path.join(__dirname, "generate-on-dark-logo.mjs");
  if (fs.existsSync(darkScript)) {
    const r = spawnSync(process.execPath, [darkScript], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  const hardenScript = path.join(__dirname, "harden-brand-lockups.mjs");
  if (fs.existsSync(hardenScript)) {
    const r = spawnSync(process.execPath, [hardenScript], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  console.log("brand icons from", path.relative(root, src));
}

await main();
