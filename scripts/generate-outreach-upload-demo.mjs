/**
 * Build email-safe upload demo still + animated GIF for outreach.
 * Mouse cursor dragging an invoice into the Paystack dashboard drop zone.
 *
 * Usage: node scripts/generate-outreach-upload-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "client/public/outreach");
const tmpDir = path.join(root, "tmp-outreach-gif");

const W = 560;
const H = 280;

function findFfmpeg() {
  const candidates = [
    "ffmpeg",
    "C:\\\\Program Files\\\\PySceneDetect\\\\ffmpeg.exe",
    "C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe",
  ];
  for (const bin of candidates) {
    const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
    if (r.status === 0) return bin;
  }
  return null;
}

function sceneSvg(docX, docY, highlight = false, done = false) {
  const dash = highlight ? "#E8423F" : "#5a6169";
  const zoneFill = highlight ? "#2a1f1f" : "#1a1d23";
  const label = done ? "UPLOADED" : "DROP PDF / JPG / PNG / CSV";
  const labelColor = done ? "#3ECF8E" : "#c5cad1";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FFF5F4"/>
  <rect x="24" y="24" width="512" height="232" rx="12" fill="#12151a" stroke="#3a4048" stroke-width="1"/>
  <rect x="24" y="24" width="88" height="232" rx="12" fill="#0e1116"/>
  <rect x="40" y="48" width="56" height="8" rx="2" fill="#E8423F"/>
  <rect x="40" y="72" width="48" height="6" rx="2" fill="#3a4048"/>
  <rect x="40" y="88" width="48" height="6" rx="2" fill="#3a4048"/>
  <rect x="40" y="104" width="48" height="6" rx="2" fill="#3a4048"/>
  <text x="132" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#e8eaed" letter-spacing="1">DASHBOARD</text>
  <rect x="132" y="72" width="110" height="36" rx="6" fill="#1c2128" stroke="#3a4048"/>
  <rect x="252" y="72" width="110" height="36" rx="6" fill="#1c2128" stroke="#3a4048"/>
  <rect x="372" y="72" width="140" height="36" rx="6" fill="#1c2128" stroke="#3a4048"/>
  <rect x="132" y="124" width="380" height="110" rx="10" fill="${zoneFill}" stroke="${dash}" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="322" y="178" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="${labelColor}" letter-spacing="0.5">${label}</text>
  ${
    done
      ? `<circle cx="322" cy="150" r="12" fill="#3ECF8E"/><path d="M316 150 l4 4 8-8" fill="none" stroke="#12151a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M310 148 h24 M322 136 v24" stroke="#6F6669" stroke-width="2" stroke-linecap="round"/>`
  }
  <g transform="translate(${docX},${docY})">
    <rect x="0" y="0" width="72" height="92" rx="4" fill="#FFFFFF" stroke="#E8E2E0" stroke-width="1"/>
    <rect x="10" y="12" width="40" height="5" rx="1.5" fill="#2B2B2B"/>
    <rect x="10" y="24" width="52" height="3" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="32" width="48" height="3" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="40" width="44" height="3" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="56" width="28" height="18" rx="2" fill="#E8423F"/>
    <text x="24" y="68" font-family="Segoe UI, Arial, sans-serif" font-size="7" font-weight="700" fill="#FFFFFF">PDF</text>
    <path d="M58 78 l0 28 7-6 5 12 6-2 -5-12 10-1 z" fill="#FFFFFF" stroke="#2B2B2B" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const pathFrames = [
    { x: 48, y: 150, highlight: false, done: false, dur: 0.35 },
    { x: 110, y: 138, highlight: false, done: false, dur: 0.18 },
    { x: 180, y: 128, highlight: true, done: false, dur: 0.18 },
    { x: 250, y: 120, highlight: true, done: false, dur: 0.18 },
    { x: 300, y: 118, highlight: true, done: false, dur: 0.18 },
    { x: 322, y: 132, highlight: true, done: true, dur: 0.7 },
    { x: 322, y: 132, highlight: true, done: true, dur: 0.5 },
  ];

  const gifOut = path.join(outDir, "upload-demo.gif");
  const gifOutV2 = path.join(outDir, "upload-demo-v2.gif");
  const pngOut = path.join(outDir, "upload-demo.png");
  const pngOutV2 = path.join(outDir, "upload-demo-v2.png");

  const stillSvg = sceneSvg(220, 124, true, false);
  await sharp(Buffer.from(stillSvg)).png().toFile(pngOut);
  fs.copyFileSync(pngOut, pngOutV2);

  const concatLines = [];
  for (let i = 0; i < pathFrames.length; i++) {
    const f = pathFrames[i];
    const framePath = path.join(tmpDir, `frame-${String(i).padStart(2, "0")}.png`);
    await sharp(Buffer.from(sceneSvg(f.x, f.y, f.highlight, f.done))).png().toFile(framePath);
    const posix = framePath.replace(/\\/g, "/");
    concatLines.push(`file '${posix}'`);
    concatLines.push(`duration ${f.dur}`);
  }
  const last = path
    .join(tmpDir, `frame-${String(pathFrames.length - 1).padStart(2, "0")}.png`)
    .replace(/\\/g, "/");
  concatLines.push(`file '${last}'`);
  const listPath = path.join(tmpDir, "frames.txt");
  fs.writeFileSync(listPath, concatLines.join("\n"), "utf8");

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    throw new Error("ffmpeg not found — cannot build a valid GIF");
  }

  const palette = path.join(tmpDir, "palette.png");

  let r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      "palettegen=max_colors=128:stats_mode=diff",
      palette,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error("ffmpeg palettegen failed");
  }

  r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-i",
      palette,
      "-lavfi",
      "paletteuse=dither=bayer:bayer_scale=3",
      "-loop",
      "0",
      gifOut,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error("ffmpeg paletteuse failed");
  }

  fs.copyFileSync(gifOut, gifOutV2);

  const meta = await sharp(gifOut, { animated: true }).metadata();
  // Must decode without "Invalid frame data"
  await sharp(gifOut).png().toBuffer();

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(
    "wrote",
    path.relative(root, pngOutV2),
    path.relative(root, gifOutV2),
    `${fs.statSync(gifOutV2).size} bytes`,
    `pages=${meta.pages}`,
    `delay=${JSON.stringify(meta.delay)}`
  );
}

await main();
