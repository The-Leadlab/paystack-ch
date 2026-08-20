/**
 * Minimal GIF89a encoder for RGBA frames (email outreach demos).
 * Adapted for small, low-color UI animations — no external deps.
 */
export class GifEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
    this.delay = 100;
    this.repeat = 0;
    this.out = { chunks: [], getData: () => Buffer.concat(this.out.chunks) };
  }

  setDelay(ms) {
    this.delay = Math.max(2, Math.round(ms / 10));
  }

  setRepeat(n) {
    this.repeat = n;
  }

  start() {
    this.out.chunks = [];
  }

  addFrame(rgba) {
    this.frames.push({ rgba: Buffer.from(rgba), delay: this.delay });
  }

  finish() {
    const w = this.width;
    const h = this.height;
    const chunks = this.out.chunks;
    chunks.push(Buffer.from("GIF89a"));
    const header = Buffer.alloc(7);
    header.writeUInt16LE(w, 0);
    header.writeUInt16LE(h, 2);
    header[4] = 0x70; // no global palette yet — use local
    header[5] = 0;
    header[6] = 0;
    chunks.push(header);

    // Netscape loop
    chunks.push(
      Buffer.from([
        0x21,
        0xff,
        0x0b,
        0x4e,
        0x45,
        0x54,
        0x53,
        0x43,
        0x41,
        0x50,
        0x45,
        0x32,
        0x2e,
        0x30,
        0x03,
        0x01,
        this.repeat & 0xff,
        (this.repeat >> 8) & 0xff,
        0x00,
      ])
    );

    for (const frame of this.frames) {
      const { indexed, palette } = quantizeRgba(frame.rgba, w * h);
      const gce = Buffer.alloc(8);
      gce[0] = 0x21;
      gce[1] = 0xf9;
      gce[2] = 0x04;
      gce[3] = 0x04; // disposal restore previous-ish / do not dispose
      gce.writeUInt16LE(frame.delay, 4);
      gce[6] = 0;
      gce[7] = 0;
      chunks.push(gce);

      const img = Buffer.alloc(10);
      img[0] = 0x2c;
      img.writeUInt16LE(0, 1);
      img.writeUInt16LE(0, 3);
      img.writeUInt16LE(w, 5);
      img.writeUInt16LE(h, 7);
      const palSize = Math.max(2, palette.length);
      const sizeCode = Math.ceil(Math.log2(palSize)) - 1;
      img[9] = 0x80 | sizeCode; // local color table
      chunks.push(img);

      const tableSize = 1 << (sizeCode + 1);
      const table = Buffer.alloc(tableSize * 3);
      for (let i = 0; i < palette.length; i++) {
        table[i * 3] = palette[i][0];
        table[i * 3 + 1] = palette[i][1];
        table[i * 3 + 2] = palette[i][2];
      }
      chunks.push(table);

      const minCodeSize = Math.max(2, sizeCode + 1);
      const compressed = lzwEncode(indexed, minCodeSize);
      chunks.push(Buffer.from([minCodeSize]));
      for (let i = 0; i < compressed.length; i += 255) {
        const slice = compressed.subarray(i, i + 255);
        chunks.push(Buffer.from([slice.length]));
        chunks.push(slice);
      }
      chunks.push(Buffer.from([0x00]));
    }
    chunks.push(Buffer.from([0x3b]));
  }
}

function quantizeRgba(rgba, n) {
  const map = new Map();
  const palette = [];
  const indexed = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    // crush to 4-bit channels for small palette
    const r = rgba[o] & 0xf0;
    const g = rgba[o + 1] & 0xf0;
    const b = rgba[o + 2] & 0xf0;
    const key = (r << 16) | (g << 8) | b;
    let idx = map.get(key);
    if (idx === undefined) {
      if (palette.length < 256) {
        idx = palette.length;
        palette.push([r, g, b]);
        map.set(key, idx);
      } else {
        idx = nearest(palette, r, g, b);
      }
    }
    indexed[i] = idx;
  }
  if (palette.length < 2) palette.push([0, 0, 0]);
  return { indexed, palette };
}

function nearest(palette, r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function lzwEncode(indexStream, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoi + 1;
  const dict = new Map();
  for (let i = 0; i < clear; i++) dict.set(String.fromCharCode(i), i);

  const outBits = [];
  let cur = 0;
  let curBits = 0;
  const write = (code) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      outBits.push(cur & 0xff);
      cur >>= 8;
      curBits -= 8;
    }
  };

  write(clear);
  let w = String.fromCharCode(indexStream[0]);
  for (let i = 1; i < indexStream.length; i++) {
    const k = String.fromCharCode(indexStream[i]);
    const wk = w + k;
    if (dict.has(wk)) {
      w = wk;
    } else {
      write(dict.get(w));
      if (nextCode < 4096) {
        dict.set(wk, nextCode++);
        if (nextCode === 1 << codeSize && codeSize < 12) codeSize++;
      } else {
        write(clear);
        dict.clear();
        for (let j = 0; j < clear; j++) dict.set(String.fromCharCode(j), j);
        codeSize = minCodeSize + 1;
        nextCode = eoi + 1;
      }
      w = k;
    }
  }
  write(dict.get(w));
  write(eoi);
  if (curBits > 0) outBits.push(cur & 0xff);
  return Buffer.from(outBits);
}
