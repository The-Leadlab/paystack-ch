/**
 * Build email-safe upload demo GIFs for light + dark themes.
 * Full Paystack dashboard (no crop) + small cursor dragging a PDF.
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

const W = 600;
const H = 400;
const CURSOR_SCALE = 0.28;
const DOC_W = 14;
const DOC_H = 18;

const FRAMES = [
  { doc: [132, 300], cur: [140, 310], highlight: false, done: false, grabbing: true, dur: 0.28 },
  { doc: [180, 268], cur: [188, 278], highlight: false, done: false, grabbing: true, dur: 0.16 },
  { doc: [235, 230], cur: [243, 240], highlight: false, done: false, grabbing: true, dur: 0.16 },
  { doc: [290, 200], cur: [298, 210], highlight: true, done: false, grabbing: true, dur: 0.16 },
  { doc: [335, 185], cur: [343, 195], highlight: true, done: false, grabbing: true, dur: 0.16 },
  { doc: [350, 180], cur: [358, 190], highlight: true, done: false, grabbing: true, dur: 0.18 },
  { doc: [352, 186], cur: [360, 196], highlight: true, done: true, grabbing: false, dur: 0.55 },
  { doc: [352, 186], cur: [385, 215], highlight: true, done: true, grabbing: false, dur: 0.65 },
];

function findFfmpeg() {
  for (const bin of [
    "ffmpeg",
    "C:\\Program Files\\PySceneDetect\\ffmpeg.exe",
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
  ]) {
    if (spawnSync(bin, ["-version"], { encoding: "utf8" }).status === 0) return bin;
  }
  return null;
}

function cursorSvg(x, y, grabbing = false) {
  const tip = grabbing
    ? `<path d="M0 0 L0 17 L4 13 L7 20 L10 19 L7 12 L12 12 Z" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="1.15" stroke-linejoin="round"/>`
    : `<path d="M0 0 L0 18 L5 14 L8 22 L11.5 20.5 L8.5 13 L14 13 Z" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="1.15" stroke-linejoin="round"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${x},${y}) scale(${CURSOR_SCALE})">
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
    <rect x="2" y="3" width="${dw}" height="${dh}" rx="3" fill="#000000" opacity="0.28"/>
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

function highlightSvg(active, done, theme) {
  if (!active && !done) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"/>`;
  }
  const stroke = done ? "#3ECF8E" : "#E8423F";
  const fill = done ? "rgba(62,207,142,0.12)" : "rgba(232,66,63,0.12)";
  const label = done ? "Uploaded" : "Drop to upload";
  const chip = theme === "light" ? "#FFFFFF" : "#12151a";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="210" y="168" width="300" height="92" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-dasharray="${done ? "0" : "8 6"}"/>
  <rect x="285" y="198" width="150" height="28" rx="6" fill="${chip}" opacity="0.92"/>
  <text x="360" y="216" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="${stroke}">${label}</text>
</svg>`;
}

/** Remap dark UI screenshot → light UI while preserving brand red. */
async function toLightDashboard(darkPngBuf) {
  const { data, info } = await sharp(darkPngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Keep Paystack red accents
    if (r > 160 && g < 110 && b < 110 && r > g + 40 && r > b + 40) continue;
    // Keep greens (income / success)
    if (g > 140 && g > r + 20 && g > b + 10) continue;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 55) {
      // near-black chrome → off-white surface
      data[i] = 248;
      data[i + 1] = 248;
      data[i + 2] = 250;
    } else if (lum > 200) {
      // light text/icons → dark
      data[i] = 28;
      data[i + 1] = 28;
      data[i + 2] = 30;
    } else if (lum < 120) {
      // dark panels → light gray cards
      const v = Math.min(255, Math.round(210 + lum * 0.2));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = Math.min(255, v + 2);
    } else {
      // mid tones flip toward light UI
      const v = Math.round(255 - lum * 0.85);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function composeFrame(baseBuf, docX, docY, cursorX, cursorY, opts = {}) {
  const { highlight = false, done = false, grabbing = true, docScale = 1, theme = "dark" } = opts;
  const layers = [
    {
      input: await sharp(Buffer.from(highlightSvg(highlight, done, theme))).png().toBuffer(),
      top: 0,
      left: 0,
    },
    { input: await sharp(Buffer.from(docSvg(docX, docY, docScale))).png().toBuffer(), top: 0, left: 0 },
    {
      input: await sharp(Buffer.from(cursorSvg(cursorX, cursorY, grabbing))).png().toBuffer(),
      top: 0,
      left: 0,
    },
  ];
  return sharp(baseBuf).composite(layers).png().toBuffer();
}

async function buildGif(ffmpeg, baseBuf, theme, gifOut, pngOut) {
  const themeDir = path.join(tmpDir, theme);
  fs.mkdirSync(themeDir, { recursive: true });
  const concatLines = [];
  for (let i = 0; i < FRAMES.length; i++) {
    const f = FRAMES[i];
    const buf = await composeFrame(baseBuf, f.doc[0], f.doc[1], f.cur[0], f.cur[1], {
      highlight: f.highlight,
      done: f.done,
      grabbing: f.grabbing,
      docScale: f.done ? 0.9 : 1,
      theme,
    });
    const framePath = path.join(themeDir, `frame-${String(i).padStart(2, "0")}.png`);
    await sharp(buf).png().toFile(framePath);
    const posix = framePath.replace(/\\/g, "/");
    concatLines.push(`file '${posix}'`);
    concatLines.push(`duration ${f.dur}`);
  }
  const last = path
    .join(themeDir, `frame-${String(FRAMES.length - 1).padStart(2, "0")}.png`)
    .replace(/\\/g, "/");
  concatLines.push(`file '${last}'`);
  const listPath = path.join(themeDir, "frames.txt");
  fs.writeFileSync(listPath, concatLines.join("\n"), "utf8");

  const still = await composeFrame(baseBuf, 335, 185, 343, 195, {
    highlight: true,
    done: false,
    grabbing: true,
    theme,
  });
  await sharp(still).png().toFile(pngOut);

  const palette = path.join(themeDir, "palette.png");
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
    throw new Error(`ffmpeg palettegen failed (${theme})`);
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
    throw new Error(`ffmpeg paletteuse failed (${theme})`);
  }
  await sharp(gifOut).png().toBuffer();
  const meta = await sharp(gifOut, { animated: true }).metadata();
  console.log(
    "wrote",
    path.relative(root, gifOut),
    `${fs.statSync(gifOut).size} bytes`,
    `pages=${meta.pages}`
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const dashPath = [
    path.join(root, "tmp-landing-v3", "dashboard.png"),
    path.join(root, "tmp-landing-v3", "dashboard.png"),
  ].find((p) => fs.existsSync(p));
  if (!dashPath) throw new Error("Missing tmp-landing-v3/dashboard.png");

  const darkBase = await sharp(dashPath)
    .resize(W, H, {
      fit: "contain",
      background: { r: 12, g: 14, b: 18, alpha: 1 },
      position: "centre",
    })
    .png()
    .toBuffer();

  const lightBase = await toLightDashboard(
    await sharp(dashPath)
      .resize(W, H, {
        fit: "contain",
        background: { r: 248, g: 248, b: 250, alpha: 1 },
        position: "centre",
      })
      .png()
      .toBuffer()
  );

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error("ffmpeg not found");

  const darkGif = path.join(outDir, "upload-demo-dark.gif");
  const darkPng = path.join(outDir, "upload-demo-dark.png");
  const lightGif = path.join(outDir, "upload-demo-light.gif");
  const lightPng = path.join(outDir, "upload-demo-light.png");

  await buildGif(ffmpeg, darkBase, "dark", darkGif, darkPng);
  await buildGif(ffmpeg, lightBase, "light", lightGif, lightPng);

  // Cache-bust aliases + legacy names (dark = previous default)
  for (const name of [
    "upload-demo-v5.gif",
    "upload-demo-v4.gif",
    "upload-demo-v3.gif",
    "upload-demo-v2.gif",
    "upload-demo.gif",
  ]) {
    fs.copyFileSync(darkGif, path.join(outDir, name));
  }
  for (const name of [
    "upload-demo-v5.png",
    "upload-demo-v4.png",
    "upload-demo-v3.png",
    "upload-demo-v2.png",
    "upload-demo.png",
  ]) {
    fs.copyFileSync(darkPng, path.join(outDir, name));
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

await main();
