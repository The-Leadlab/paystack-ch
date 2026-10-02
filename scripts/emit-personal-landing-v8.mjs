import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "tmp-landing-v3", "personal.png");
const lockup = path.join(root, "client/public/brand", "paystack-lockup-128.png");
const out = path.join(root, "client/public/landing", "screenshot-personal-v8.jpg");

const meta = await sharp(src).metadata();
const cover = { left: 0, top: 8, width: 260, height: 72 };
const sample = await sharp(src)
  .extract({ left: 4, top: 4, width: 20, height: 20 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const r = sample.data[0];
const g = sample.data[1];
const b = sample.data[2];
const plate = Buffer.from(
  `<svg width="${meta.width}" height="${meta.height}"><rect x="${cover.left}" y="${cover.top}" width="${cover.width}" height="${cover.height}" fill="rgb(${r},${g},${b})"/></svg>`
);

const lockupH = 32;
const lockupBuf = await sharp(lockup).resize({ height: lockupH }).png().toBuffer();

await sharp(src)
  .composite([
    { input: plate, top: 0, left: 0 },
    {
      input: lockupBuf,
      top: cover.top + Math.round((cover.height - lockupH) / 2),
      left: 18,
    },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(out);

console.log("Wrote", out);
