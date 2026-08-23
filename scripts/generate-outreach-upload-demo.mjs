/**
 * Build a realistic email-safe GIF: full Paystack dashboard + small cursor dragging a PDF.
 *
 * Rules (super prompt):
 * - Show the FULL dashboard (fit contain) — never crop the product UI.
 * - Keep the PDF and mouse SMALL so they read like a real desktop cursor + file icon.
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

/** Email width; height follows full 1536×1024 dashboard aspect (no crop). */
const W = 600;
const H = 400;

/** Realistic desktop cursor (~9px tip); PDF icon ~ one table-row tall. */
const CURSOR_SCALE = 0.28;
const DOC_W = 14;
const DOC_H = 18;

function findFfmpeg() {
  const candidates = [
    "ffmpeg",
    "C:\\Program Files\\PySceneDetect\\ffmpeg.exe",
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
  ];
  for (const bin of candidates) {
    const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
    if (r.status === 0) return bin;
  }
  return null;
}

function cursorSvg(x, y, grabbing = false) {
  const s = CURSOR_SCALE;
  const tip = grabbing
    ? `<path d="M0 0 L0 17 L4 13 L7 20 L10 19 L7 12 L12 12 Z" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="1.15" stroke-linejoin="round"/>`
    : `<path d="M0 0 L0 18 L5 14 L8 22 L11.5 20.5 L8.5 13 L14 13 Z" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="1.15" stroke-linejoin="round"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${x},${y}) scale(${s})">
    <path d="M1 2 L1 20 L6 16 L9 24 L12.5 22.5 L9.5 15 L15 15 Z" fill="#000000" opacity="0.25"/>
    ${tip}
  </g>
</svg>`;
}

function docSvg(x, y, scale = 1) {
  const dw = Math.round(DOC_W * scale);
  const dh = Math.round(DOC_H * scale);
  const fsPx = Math.max(6, Math.round(7 * scale));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${x},${y})">
    <rect x="2" y="3" width="${dw}" height="${dh}" rx="3" fill="#000000" opacity="0.3"/>
    <rect x="0" y="0" width="${dw}" height="${dh}" rx="3" fill="#FFFFFF" stroke="#D0C8C6" stroke-width="1"/>
    <rect x="5" y="6" width="${Math.round(dw * 0.52)}" height="3" rx="1" fill="#2B2B2B"/>
    <rect x="5" y="12" width="${Math.round(dw * 0.7)}" height="2" rx="1" fill="#C9C2BF"/>
    <rect x="5" y="16" width="${Math.round(dw * 0.64)}" height="2" rx="1" fill="#C9C2BF"/>
    <rect x="5" y="20" width="${Math.round(dw * 0.58)}" height="2" rx="1" fill="#C9C2BF"/>
    <rect x="5" y="28" width="${Math.round(dw * 0.42)}" height="11" rx="2" fill="#E8423F"/>
    <text x="${5 + Math.round(dw * 0.21)}" y="${28 + 8}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fsPx}" font-weight="700" fill="#FFFFFF">PDF</text>
  </g>
</svg>`;
}

function highlightSvg(active, done) {
  if (!active && !done) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"/>`;
  }
  // Drop zone on full-frame dashboard (sidebar ~88px; zone centered in main pane)
  const stroke = done ? "#3ECF8E" : "#E8423F";
  const fill = done ? "rgba(62,207,142,0.10)" : "rgba(232,66,63,0.12)";
  const label = done ? "Uploaded" : "Drop to upload";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="210" y="168" width="300" height="92" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-dasharray="${done ? "0" : "8 6"}"/>
  <rect x="285" y="198" width="150" height="28" rx="6" fill="#12151a" opacity="0.9"/>
  <text x="360" y="216" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="${stroke}">${label}</text>
</svg>`;
}

async function composeFrame(baseBuf, docX, docY, cursorX, cursorY, opts = {}) {
  const { highlight = false, done = false, grabbing = true, docScale = 1 } = opts;
  const layers = [
    { input: await sharp(Buffer.from(highlightSvg(highlight, done))).png().toBuffer(), top: 0, left: 0 },
    { input: await sharp(Buffer.from(docSvg(docX, docY, docScale))).png().toBuffer(), top: 0, left: 0 },
    {
      input: await sharp(Buffer.from(cursorSvg(cursorX, cursorY, grabbing))).png().toBuffer(),
      top: 0,
      left: 0,
    },
  ];
  return sharp(baseBuf).composite(layers).png().toBuffer();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const dashCandidates = [
    path.join(root, "tmp-landing-v3", "dashboard.png"),
    path.join(root, "tmp-landing-v3", "dashboard.png"),
  ];
  const dashPath = dashCandidates.find((p) => fs.existsSync(p));
  if (!dashPath) {
    throw new Error("Missing dashboard source (tmp-landing-v3/dashboard.png)");
  }

  // Full dashboard, letterboxed if needed — never crop product UI
  const baseBuf = await sharp(dashPath)
    .resize(W, H, {
      fit: "contain",
      background: { r: 12, g: 14, b: 18, alpha: 1 },
      position: "centre",
    })
    .png()
    .toBuffer();

  // Path into the drop zone (coords for full 600×400 frame).
  // Cursor tip sits near the PDF bottom-right (~doc + 8, doc + 12).
  const frames = [
    { doc: [132, 300], cur: [140, 310], highlight: false, done: false, grabbing: true, dur: 0.28 },
    { doc: [180, 268], cur: [188, 278], highlight: false, done: false, grabbing: true, dur: 0.16 },
    { doc: [235, 230], cur: [243, 240], highlight: false, done: false, grabbing: true, dur: 0.16 },
    { doc: [290, 200], cur: [298, 210], highlight: true, done: false, grabbing: true, dur: 0.16 },
    { doc: [335, 185], cur: [343, 195], highlight: true, done: false, grabbing: true, dur: 0.16 },
    { doc: [350, 180], cur: [358, 190], highlight: true, done: false, grabbing: true, dur: 0.18 },
    { doc: [352, 186], cur: [360, 196], highlight: true, done: true, grabbing: false, dur: 0.55 },
    { doc: [352, 186], cur: [385, 215], highlight: true, done: true, grabbing: false, dur: 0.65 },
  ];

  const concatLines = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const buf = await composeFrame(baseBuf, f.doc[0], f.doc[1], f.cur[0], f.cur[1], {
      highlight: f.highlight,
      done: f.done,
      grabbing: f.grabbing,
      docScale: f.done ? 0.9 : 1,
    });
    const framePath = path.join(tmpDir, `frame-${String(i).padStart(2, "0")}.png`);
    await sharp(buf).png().toFile(framePath);
    const posix = framePath.replace(/\\/g, "/");
    concatLines.push(`file '${posix}'`);
    concatLines.push(`duration ${f.dur}`);
  }
  const last = path
    .join(tmpDir, `frame-${String(frames.length - 1).padStart(2, "0")}.png`)
    .replace(/\\/g, "/");
  concatLines.push(`file '${last}'`);
  const listPath = path.join(tmpDir, "frames.txt");
  fs.writeFileSync(listPath, concatLines.join("\n"), "utf8");

  const still = await composeFrame(baseBuf, 335, 185, 343, 195, {
    highlight: true,
    done: false,
    grabbing: true,
  });

  const pngOut = path.join(outDir, "upload-demo-v4.png");
  const gifOut = path.join(outDir, "upload-demo-v4.gif");
  const pngV3 = path.join(outDir, "upload-demo-v3.png");
  const gifV3 = path.join(outDir, "upload-demo-v3.gif");
  const pngLegacy = path.join(outDir, "upload-demo-v2.png");
  const gifLegacy = path.join(outDir, "upload-demo-v2.gif");
  const pngRoot = path.join(outDir, "upload-demo.png");
  const gifRoot = path.join(outDir, "upload-demo.gif");
  await sharp(still).png().toFile(pngOut);

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error("ffmpeg not found — cannot build GIF");

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
      "palettegen=max_colors=192:stats_mode=diff",
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
      "paletteuse=dither=bayer:bayer_scale=2",
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

  for (const dest of [gifV3, gifLegacy, gifRoot]) fs.copyFileSync(gifOut, dest);
  for (const dest of [pngV3, pngLegacy, pngRoot]) fs.copyFileSync(pngOut, dest);

  const gifMeta = await sharp(gifOut, { animated: true }).metadata();
  await sharp(gifOut).png().toBuffer();

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(
    "wrote",
    path.relative(root, gifOut),
    `${fs.statSync(gifOut).size} bytes`,
    `${W}x${H}`,
    `pages=${gifMeta.pages}`,
    `delay=${JSON.stringify(gifMeta.delay)}`
  );
}

await main();
