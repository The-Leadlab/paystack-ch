/**
 * Build a realistic email-safe GIF: real Paystack dashboard + cursor dragging a PDF.
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
const H = 338;

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
  const tip = grabbing
    ? `<path d="M0 0 L0 17 L4 13 L7 20 L10 19 L7 12 L12 12 Z" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="1.2" stroke-linejoin="round"/>`
    : `<path d="M0 0 L0 18 L5 14 L8 22 L11.5 20.5 L8.5 13 L14 13 Z" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="1.2" stroke-linejoin="round"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${x},${y})">
    <path d="M1 2 L1 20 L6 16 L9 24 L12.5 22.5 L9.5 15 L15 15 Z" fill="#000000" opacity="0.28"/>
    ${tip}
  </g>
</svg>`;
}

function docSvg(x, y, scale = 1) {
  const dw = Math.round(78 * scale);
  const dh = Math.round(100 * scale);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${x},${y})">
    <rect x="4" y="6" width="${dw}" height="${dh}" rx="5" fill="#000000" opacity="0.35"/>
    <rect x="0" y="0" width="${dw}" height="${dh}" rx="5" fill="#FFFFFF" stroke="#D8D0CE" stroke-width="1"/>
    <rect x="10" y="12" width="${Math.round(dw * 0.55)}" height="6" rx="2" fill="#2B2B2B"/>
    <rect x="10" y="24" width="${Math.round(dw * 0.72)}" height="3.5" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="32" width="${Math.round(dw * 0.66)}" height="3.5" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="40" width="${Math.round(dw * 0.6)}" height="3.5" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="48" width="${Math.round(dw * 0.7)}" height="3.5" rx="1" fill="#C9C2BF"/>
    <rect x="10" y="64" width="${Math.round(dw * 0.38)}" height="20" rx="3" fill="#E8423F"/>
    <text x="${10 + Math.round(dw * 0.19)}" y="78" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="9" font-weight="700" fill="#FFFFFF">PDF</text>
  </g>
</svg>`;
}

function highlightSvg(active, done) {
  if (!active && !done) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"/>`;
  }
  const stroke = done ? "#3ECF8E" : "#E8423F";
  const fill = done ? "rgba(62,207,142,0.12)" : "rgba(232,66,63,0.14)";
  const label = done ? "Uploaded" : "Drop to upload";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="168" y="118" width="390" height="168" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-dasharray="${done ? "0" : "10 7"}"/>
  <rect x="268" y="178" width="190" height="36" rx="8" fill="#12151a" opacity="0.88"/>
  <text x="363" y="201" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="${stroke}">${label}</text>
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

  const meta = await sharp(dashPath).metadata();
  const extractW = Math.min(1456, meta.width - 40);
  const extractH = Math.min(920, meta.height - 36);
  const baseBuf = await sharp(dashPath)
    .extract({
      left: Math.min(40, Math.max(0, meta.width - extractW)),
      top: Math.min(36, Math.max(0, meta.height - extractH)),
      width: extractW,
      height: extractH,
    })
    .resize(W, H, { fit: "cover", position: "northwest" })
    .png()
    .toBuffer();

  const frames = [
    { doc: [42, 210], cur: [108, 292], highlight: false, done: false, grabbing: true, dur: 0.28 },
    { doc: [110, 188], cur: [176, 270], highlight: false, done: false, grabbing: true, dur: 0.16 },
    { doc: [190, 160], cur: [256, 242], highlight: false, done: false, grabbing: true, dur: 0.16 },
    { doc: [270, 142], cur: [336, 224], highlight: true, done: false, grabbing: true, dur: 0.16 },
    { doc: [330, 132], cur: [396, 214], highlight: true, done: false, grabbing: true, dur: 0.16 },
    { doc: [360, 128], cur: [426, 210], highlight: true, done: false, grabbing: true, dur: 0.18 },
    { doc: [372, 136], cur: [430, 218], highlight: true, done: true, grabbing: false, dur: 0.55 },
    { doc: [372, 136], cur: [450, 240], highlight: true, done: true, grabbing: false, dur: 0.65 },
  ];

  const concatLines = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const buf = await composeFrame(baseBuf, f.doc[0], f.doc[1], f.cur[0], f.cur[1], {
      highlight: f.highlight,
      done: f.done,
      grabbing: f.grabbing,
      docScale: f.done ? 0.92 : 1,
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

  const still = await composeFrame(baseBuf, 330, 132, 396, 214, {
    highlight: true,
    done: false,
    grabbing: true,
  });
  const pngOut = path.join(outDir, "upload-demo-v3.png");
  const gifOut = path.join(outDir, "upload-demo-v3.gif");
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

  fs.copyFileSync(gifOut, gifLegacy);
  fs.copyFileSync(pngOut, pngLegacy);
  fs.copyFileSync(gifOut, gifRoot);
  fs.copyFileSync(pngOut, pngRoot);

  const gifMeta = await sharp(gifOut, { animated: true }).metadata();
  await sharp(gifOut).png().toBuffer();

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(
    "wrote",
    path.relative(root, gifOut),
    `${fs.statSync(gifOut).size} bytes`,
    `pages=${gifMeta.pages}`,
    `delay=${JSON.stringify(gifMeta.delay)}`
  );
}

await main();
