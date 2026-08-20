/**
 * Build email-safe upload demo still + animated GIF for outreach.
 * Mouse cursor dragging an invoice into the Paystack dashboard drop zone.
 *
 * Usage: node scripts/generate-outreach-upload-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { GifEncoder } from "./lib/miniGifEncoder.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "client/public/outreach");

const W = 560;
const H = 280;

function sceneSvg(docX, docY, highlight = false, done = false) {
  const dash = highlight ? "#E8423F" : "#5a6169";
  const zoneFill = highlight ? "#2a1f1f" : "#1a1d23";
  const label = done ? "UPLOADED" : "DROP PDF / JPG / PNG / CSV";
  const labelColor = done ? "#3ECF8E" : "#c5cad1";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FFF5F4"/>
  <rect x="24" y="24" width="512" height="232" rx="12" fill="#12151a" stroke="#3a4048" stroke-width="1"/>
  <!-- sidebar stub -->
  <rect x="24" y="24" width="88" height="232" rx="12" fill="#0e1116"/>
  <rect x="40" y="48" width="56" height="8" rx="2" fill="#E8423F"/>
  <rect x="40" y="72" width="48" height="6" rx="2" fill="#3a4048"/>
  <rect x="40" y="88" width="48" height="6" rx="2" fill="#3a4048"/>
  <rect x="40" y="104" width="48" height="6" rx="2" fill="#3a4048"/>
  <!-- main -->
  <text x="132" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#e8eaed" letter-spacing="1">DASHBOARD</text>
  <rect x="132" y="72" width="110" height="36" rx="6" fill="#1c2128" stroke="#3a4048"/>
  <rect x="252" y="72" width="110" height="36" rx="6" fill="#1c2128" stroke="#3a4048"/>
  <rect x="372" y="72" width="140" height="36" rx="6" fill="#1c2128" stroke="#3a4048"/>
  <!-- drop zone -->
  <rect x="132" y="124" width="380" height="110" rx="10" fill="${zoneFill}" stroke="${dash}" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="322" y="178" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="${labelColor}" letter-spacing="0.5">${label}</text>
  ${
    done
      ? `<circle cx="322" cy="150" r="12" fill="#3ECF8E"/><path d="M316 150 l4 4 8-8" fill="none" stroke="#12151a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M310 148 h24 M322 136 v24" stroke="#6F6669" stroke-width="2" stroke-linecap="round"/>`
  }
  <!-- invoice document -->
  <g transform="translate(${docX},${docY})">
    <rect x="0" y="0" width="72" height="92" rx="4" fill="#FFFFFF" stroke="#E8E2E0" stroke-width="1"/>
    <rect x="10" y="12" width="40" height="5" rx="1.5" fill="#2B2B2B"/>
    <rect x="10" y="24" width="52" height="3" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="32" width="48" height="3" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="40" width="44" height="3" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="56" width="28" height="18" rx="2" fill="#E8423F"/>
    <text x="24" y="68" font-family="Segoe UI, Arial, sans-serif" font-size="7" font-weight="700" fill="#FFFFFF">PDF</text>
    <!-- mouse cursor -->
    <path d="M58 78 l0 28 7-6 5 12 6-2 -5-12 10-1 z" fill="#FFFFFF" stroke="#2B2B2B" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function svgToRgba(svg) {
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const pathFrames = [
    { x: 48, y: 150, highlight: false, done: false, delay: 35 },
    { x: 110, y: 138, highlight: false, done: false, delay: 18 },
    { x: 180, y: 128, highlight: true, done: false, delay: 18 },
    { x: 250, y: 120, highlight: true, done: false, delay: 18 },
    { x: 300, y: 118, highlight: true, done: false, delay: 18 },
    { x: 322, y: 132, highlight: true, done: true, delay: 70 },
    { x: 322, y: 132, highlight: true, done: true, delay: 50 },
  ];

  // Static hero still (mid-drag, email-safe PNG)
  const stillSvg = sceneSvg(220, 124, true, false);
  await sharp(Buffer.from(stillSvg)).png().toFile(path.join(outDir, "upload-demo.png"));

  const enc = new GifEncoder(W, H);
  enc.setRepeat(0);
  enc.start();

  for (const f of pathFrames) {
    const { data } = await svgToRgba(sceneSvg(f.x, f.y, f.highlight, f.done));
    enc.setDelay(f.delay * 10); // gif delay unit = 10ms
    enc.addFrame(data);
  }
  enc.finish();
  const gif = enc.out.getData();
  fs.writeFileSync(path.join(outDir, "upload-demo.gif"), gif);

  console.log(
    "wrote",
    path.relative(root, path.join(outDir, "upload-demo.png")),
    path.relative(root, path.join(outDir, "upload-demo.gif")),
    `${gif.length} bytes`
  );
}

await main();
