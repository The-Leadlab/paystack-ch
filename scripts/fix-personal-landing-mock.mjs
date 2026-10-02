/**
 * Align personal Overview marketing mock KPIs with visible transactions + product math.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backup = path.join(root, "tmp-landing-v3", "personal.orig.png");
const srcPath = path.join(root, "tmp-landing-v3", "personal.png");
const generated = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-attia-OneDrive-Bureau-Paginas-web-paystack/assets/personal-overview-fixed.jpg"
);

async function fromGenerated() {
  if (!fs.existsSync(generated)) return false;
  // Prefer AI-fixed mock resized to landing size, then logo patcher will harden brand strip
  await sharp(generated)
    .resize(1536, 1024, { fit: "cover", position: "top" })
    .png()
    .toFile(srcPath);
  console.log("Using generated personal-overview-fixed.jpg → personal.png");
  return true;
}

async function fromOverlay() {
  if (!fs.existsSync(backup)) {
    if (fs.existsSync(srcPath)) fs.copyFileSync(srcPath, backup);
  }
  const src = backup;
  const income = "CHF 7'450.00";
  const expenses = "CHF 1'899.95";
  const savings = "CHF 5'550.05";
  const balance = "CHF 16'203.45";

  const values = [
    { x: 310, y: 232, w: 210, h: 38, text: income, size: 23, weight: 700, fill: "#0d9488" },
    { x: 555, y: 232, w: 210, h: 38, text: expenses, size: 23, weight: 700, fill: "#0d9488" },
    { x: 800, y: 232, w: 210, h: 38, text: savings, size: 23, weight: 700, fill: "#0d9488" },
    { x: 1045, y: 232, w: 220, h: 38, text: balance, size: 23, weight: 700, fill: "#0d9488" },
  ];
  const subs = [
    { x: 555, y: 274, w: 200, h: 18, text: "Listed this month", size: 11, weight: 500, fill: "#6b7280" },
    { x: 800, y: 274, w: 200, h: 18, text: "Income − expenses", size: 11, weight: 500, fill: "#6b7280" },
    { x: 1045, y: 274, w: 200, h: 18, text: "Through May 2025", size: 11, weight: 500, fill: "#6b7280" },
  ];
  const hint = {
    x: 900,
    y: 560,
    w: 320,
    h: 36,
    text: "Supports CSV, PDF, JPG, PNG",
    size: 12,
    weight: 500,
    fill: "#6b7280",
  };
  const all = [...values, ...subs, hint];
  const svg = Buffer.from(
    `<svg width="1536" height="1024" xmlns="http://www.w3.org/2000/svg">${all
      .map(
        (r) =>
          `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ffffff"/><text x="${r.x + 4}" y="${r.y + r.h * 0.72}" font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="${r.size}" font-weight="${r.weight}" fill="${r.fill}">${r.text}</text>`
      )
      .join("")}</svg>`
  );
  await sharp(src).composite([{ input: svg }]).png().toFile(srcPath);
  console.log("Overlay-patched personal.png from orig");
}

async function main() {
  const usedGen = await fromGenerated();
  if (!usedGen) await fromOverlay();
  await sharp(srcPath)
    .extract({ left: 280, top: 160, width: 1100, height: 160 })
    .toFile(path.join(root, "tmp-landing-v3", "kpi-strip.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
