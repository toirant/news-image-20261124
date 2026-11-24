// news-image-20261124 — "The World in One Day: Tuesday 24 November 2026"
//
// A newspaper front page drawn in code. It sums up the world news of
// Tuesday 24 November 2026, as reported by that morning (about 03:00 UTC):
//   * Nvidia reinstates Jensen Huang as CEO after pressure from President
//     Trump; shares jump about 30%.
//   * Ukraine says seven sea drones sank the Russian corvette Merkury at
//     Benghazi, Libya, and hit the cargo ship MV Angara.
//   * Allies warn Russia may launch a nuclear space weapon next month;
//     NATO vows to strengthen space defences.
//   * Russian strikes kill at least 14 people in the Kyiv region.
//   * Also today: Trump orders federal executions expedited; US states sue
//     Musk companies over sexualised images made by the Grok chatbot;
//     China sentences an official to death for spying; more bodies found
//     after the Indonesia candy factory fire; drones hit homes and a UN
//     building in Sudan; the US is confirmed as a host of the 2031
//     Women's World Cup.
//
// The program is deterministic: no network, no clock, no randomness. It
// draws a 1024x1024 RGB canvas with a hand-built 5x7 bitmap font and
// writes it as a PNG (zlib deflate, hand-written CRC32 and chunk framing)
// to /output/entry.png, or $MAKEFUN_OUTPUT_DIR when set. Two runs write
// byte-identical output.
//
// Node 22, standard library only. Run: node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [248, 244, 233];
const INK: RGB = [22, 22, 22];
const RED: RGB = [158, 27, 27];
const NAVY: RGB = [22, 53, 95];
const GREEN: RGB = [31, 122, 58];
const DARKGREEN: RGB = [18, 74, 36];
const GOLD: RGB = [201, 162, 39];
const SEA: RGB = [29, 95, 122];
const DARKSEA: RGB = [16, 58, 76];
const ORANGE: RGB = [214, 106, 24];
const YELLOW: RGB = [240, 200, 60];
const GREY: RGB = [120, 116, 104];
const LIGHTGREY: RGB = [190, 184, 168];
const WHITE: RGB = [255, 255, 255];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
        i += 3;
      }
    }
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
  }

  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, t, h, c);
  }

  // Bresenham line, any thickness by stamping squares.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    const half = Math.floor(t / 2);
    for (;;) {
      this.fillRect(x - half, y - half, t, t, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  filledCircle(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      this.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB, t = 1): void {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + r * Math.cos(rad));
      const y = Math.round(cy + r * Math.sin(rad));
      this.fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    }
  }

  // A filled triangle, scanline by scanline.
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.floor(Math.min(...xs));
        const hi = Math.ceil(Math.max(...xs));
        this.fillRect(lo, y, hi - lo + 1, 1, c);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows; each row is 5 bits, leftmost first.
// Only capitals, digits and the punctuation the page needs.
// ---------------------------------------------------------------------------

const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  '-': [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  '+': [0, 0x04, 0x04, 0x0e, 0x04, 0x04, 0],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '*': [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
};

const CHAR_W = 6; // 5 pixels of glyph + 1 of spacing
const CHAR_H = 7;

function textWidth(text: string, scale: number): number {
  return text.length * CHAR_W * scale - scale;
}

function drawChar(cv: Canvas, ch: string, x: number, y: number, scale: number, c: RGB): void {
  const glyph = FONT[ch] ?? FONT['?'];
  for (let r = 0; r < CHAR_H; r++) {
    const row = glyph[r];
    for (let col = 0; col < 5; col++) {
      if (row & (1 << (4 - col))) {
        cv.fillRect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function drawText(cv: Canvas, text: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    drawChar(cv, ch, cx, y, scale, c);
    cx += CHAR_W * scale;
  }
}

function drawTextCentered(cv: Canvas, text: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(cv, text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, c);
}

// Greedy word wrap. Returns the lines that fit maxChars per line.
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    if (cur === '') {
      cur = word;
    } else if (cur.length + 1 + word.length <= maxChars) {
      cur += ' ' + word;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// Draw wrapped text in a column; returns the y just below the last line.
function drawWrapped(
  cv: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  maxChars: number,
  lineGap = 4,
): number {
  const lines = wrap(text, maxChars);
  let cy = y;
  for (const line of lines) {
    drawText(cv, line, x, cy, scale, c);
    cy += CHAR_H * scale + lineGap;
  }
  return cy;
}

// A small solid square bullet, then wrapped text beside it.
function drawBulletItem(
  cv: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  maxChars: number,
  bullet: RGB,
): number {
  const s = scale * 2;
  cv.fillRect(x, y + 2, s, s, bullet);
  return drawWrapped(cv, text, x + s + 8, y, scale, c, maxChars);
}

// ---------------------------------------------------------------------------
// PNG encoder (RGB, no filtering, zlib level 9 — deterministic)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0; // filter: none
    Buffer.from(cv.px.buffer, y * cv.w * 3, cv.w * 3).copy(
      raw,
      y * (1 + cv.w * 3) + 1,
    );
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Pictures: small pictograms drawn from rectangles, lines and circles
// ---------------------------------------------------------------------------

// A computer chip: dark body, gold pins, green circuit traces.
function drawChip(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, DARKGREEN);
  const bw = Math.floor(w * 0.52);
  const bh = Math.floor(h * 0.52);
  const bx = x + Math.floor((w - bw) / 2);
  const by = y + Math.floor((h - bh) / 2);
  cv.fillRect(bx, by, bw, bh, GREEN);
  cv.rect(bx, by, bw, bh, GOLD, 3);
  // Pins on all four sides.
  const pin = 10;
  const gap = 16;
  for (let px = x + 14; px < x + w - 14; px += gap) {
    cv.fillRect(px, y - pin, 6, pin, GOLD);
    cv.fillRect(px, y + h, 6, pin, GOLD);
  }
  for (let py = y + 14; py < y + h - 14; py += gap) {
    cv.fillRect(x - pin, py, pin, 6, GOLD);
    cv.fillRect(x + w, py, pin, 6, GOLD);
  }
  // Circuit traces from the die.
  cv.line(bx + 8, by + 8, bx + 26, by + 26, GOLD, 2);
  cv.line(bx + bw - 8, by + 8, bx + bw - 26, by + 26, GOLD, 2);
  cv.line(bx + 8, by + bh - 8, bx + 26, by + bh - 26, GOLD, 2);
  cv.line(bx + bw - 8, by + bh - 8, bx + bw - 26, by + bh - 26, GOLD, 2);
  cv.filledCircle(bx + Math.floor(bw / 2), by + Math.floor(bh / 2), 7, WHITE);
}

// A warship at sea with an explosion above it.
function drawWarship(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const seaY = y + Math.floor(h * 0.72);
  cv.fillRect(x, seaY, w, h - Math.floor(h * 0.72), SEA);
  // Waves.
  for (let wx = x; wx < x + w; wx += 26) {
    cv.line(wx, seaY + 8, wx + 13, seaY + 4, WHITE, 2);
    cv.line(wx + 13, seaY + 4, wx + 26, seaY + 8, WHITE, 2);
  }
  // Hull: stepped rectangles narrowing to a bow on the right.
  const hullY = seaY - 16;
  cv.fillRect(x + 8, hullY, Math.floor(w * 0.62), 16, INK);
  cv.fillRect(x + Math.floor(w * 0.62), hullY + 6, Math.floor(w * 0.3), 10, INK);
  cv.triangle(
    x + Math.floor(w * 0.92), hullY + 6,
    x + w - 4, hullY + 12,
    x + Math.floor(w * 0.92), hullY + 16,
    INK,
  );
  // Superstructure and mast, with a small red ensign on the masthead.
  cv.fillRect(x + 26, hullY - 14, 46, 14, INK);
  cv.fillRect(x + 40, hullY - 30, 6, 18, INK);
  cv.fillRect(x + 84, hullY - 10, 34, 10, INK);
  cv.triangle(x + 46, hullY - 30, x + 64, hullY - 26, x + 46, hullY - 22, RED);
  cv.line(x + 43, hullY - 30, x + 62, hullY - 38, RED, 3);
  // Explosion starburst above the stern.
  const ex = x + 60;
  const ey = y + 14;
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    const len = a % 2 === 0 ? 26 : 14;
    cv.line(
      ex, ey,
      Math.round(ex + len * Math.cos(ang)),
      Math.round(ey + len * Math.sin(ang)),
      a % 3 === 0 ? YELLOW : ORANGE,
      4,
    );
  }
  cv.filledCircle(ex, ey, 10, YELLOW);
  cv.filledCircle(ex, ey, 5, ORANGE);
  // Smoke.
  cv.filledCircle(ex - 22, ey - 16, 7, GREY);
  cv.filledCircle(ex + 20, ey - 20, 8, GREY);
  cv.filledCircle(ex + 34, ey - 8, 6, GREY);
}

// A satellite with solar panels above the Earth curve.
function drawSatellite(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, NAVY);
  // Stars.
  const stars: [number, number][] = [
    [18, 12], [52, 26], [96, 10], [150, 30], [210, 14], [250, 40],
    [300, 16], [340, 34], [380, 12], [420, 28], [120, 48], [280, 52],
  ];
  for (const [sx, sy] of stars) cv.filledCircle(x + sx, y + sy, 2, WHITE);
  const cx = x + Math.floor(w * 0.5);
  const cy = y + Math.floor(h * 0.42);
  // Solar panels.
  cv.fillRect(cx - 150, cy - 12, 120, 24, SEA);
  cv.fillRect(cx + 30, cy - 12, 120, 24, SEA);
  for (let px = cx - 150; px < cx - 30; px += 20) cv.vline(px, cy - 12, 24, WHITE, 1);
  for (let px = cx + 30; px < cx + 150; px += 20) cv.vline(px, cy - 12, 24, WHITE, 1);
  cv.rect(cx - 150, cy - 12, 120, 24, GOLD, 2);
  cv.rect(cx + 30, cy - 12, 120, 24, GOLD, 2);
  // Body and flash.
  cv.fillRect(cx - 30, cy - 18, 60, 36, GOLD);
  cv.rect(cx - 30, cy - 18, 60, 36, INK, 2);
  // Blast / flash near the body: a nuclear-armed satellite warning.
  cv.filledCircle(cx + 96, cy - 34, 6, RED);
  cv.filledCircle(cx + 96, cy - 34, 3, YELLOW);
  // Earth as a thin green horizon strip at the bottom of the panel.
  cv.fillRect(x, y + h - 12, w, 12, GREEN);
}

// ---------------------------------------------------------------------------
// The front page
// ---------------------------------------------------------------------------

const MARGIN = 28;
const COLW = W - MARGIN * 2; // 968

function drawPage(): Canvas {
  const cv = new Canvas(W, H, PAPER);

  // Masthead.
  cv.hline(0, 10, W, INK, 4);
  drawTextCentered(cv, 'THE WORLD IN ONE DAY', W / 2, 26, 6, INK);
  drawTextCentered(cv, 'TUESDAY 24 NOVEMBER 2026', W / 2, 82, 3, RED);
  cv.hline(MARGIN, 112, COLW, INK, 3);
  cv.hline(MARGIN, 118, COLW, INK, 1);

  // ---- Lead story: Nvidia / Huang --------------------------------------
  const leadTop = 132;
  drawText(cv, 'TECHNOLOGY - UNITED STATES', MARGIN, leadTop, 2, RED);
  drawText(cv, 'HUANG IS BACK', MARGIN, leadTop + 26, 7, INK);
  drawText(cv, 'AT NVIDIA', MARGIN, leadTop + 26 + 53, 7, INK);
  const subY = leadTop + 26 + 53 + 53;
  drawWrapped(
    cv,
    'NVIDIA REINSTATES ITS CHIEF AFTER TRUMP PUSH; SHARES JUMP ABOUT 30%',
    MARGIN, subY, 3, NAVY, 35,
  );
  const bodyY = subY + 2 * (CHAR_H * 3 + 4) + 8;
  let by = drawWrapped(
    cv,
    "NVIDIA'S BOARD VOTED ON MONDAY TO REINSTATE JENSEN HUANG AS CHIEF EXECUTIVE, 12 DAYS AFTER HE RESIGNED OVER AFFAIRS INCLUDING ONE WITH AN ALLEGED CHINESE SPY.",
    MARGIN, bodyY, 2, INK, 55,
  );
  by = drawWrapped(
    cv,
    "TRUMP, WHO LOBBIED THE BOARD AND SENT JD VANCE TO PRESS THE CASE, SAID HIS INTERVENTION WAS 'VERY IMPORTANT'.",
    MARGIN, by + 6, 2, INK, 55,
  );

  // Chip picture, right of the lead.
  const artX = 700;
  const artY = leadTop + 4;
  const artW = W - MARGIN - artX; // 296
  const artH = 300;
  cv.rect(artX, artY, artW, artH, INK, 2);
  cv.fillRect(artX + 2, artY + 2, artW - 4, artH - 4, WHITE);
  drawChip(cv, artX + 78, artY + 46, 140, 140);
  drawTextCentered(cv, 'JENSEN HUANG', artX + artW / 2, artY + 214, 2, INK);
  drawTextCentered(cv, 'CO-FOUNDER, BACK AS', artX + artW / 2, artY + 234, 2, INK);
  drawTextCentered(cv, 'CEO AFTER 12 DAYS OUT', artX + artW / 2, artY + 254, 2, INK);
  drawTextCentered(cv, 'SHARES +30%', artX + artW / 2, artY + 274, 3, GREEN);

  // ---- Divider ----------------------------------------------------------
  const midRule = 470;
  cv.hline(MARGIN, midRule, COLW, INK, 3);
  cv.hline(MARGIN, midRule + 6, COLW, INK, 1);

  // ---- Middle row: two stories -----------------------------------------
  const midTop = 488;
  const halfW = 472;
  const rightX = MARGIN + halfW + 24;

  // Left: Ukraine sinks the Russian warship off Libya.
  drawText(cv, 'UKRAINE - LIBYA', MARGIN, midTop, 2, RED);
  drawText(cv, 'WAR GOES', MARGIN, midTop + 24, 5, INK);
  drawText(cv, 'GLOBAL', MARGIN, midTop + 24 + 38, 5, INK);
  let ly = drawWrapped(
    cv,
    'UKRAINE SINKS RUSSIAN WARSHIP OFF LIBYA',
    MARGIN, midTop + 24 + 38 + 38 + 6, 3, NAVY, 26,
  );
  ly = drawWrapped(
    cv,
    'ZELENSKY SAID SEVEN UKRAINIAN SEA DRONES SANK THE CORVETTE MERKURY AT BENGHAZI AND DESTROYED A KA-27 HELICOPTER. THE CARGO SHIP MV ANGARA WAS ALSO HIT.',
    MARGIN, ly + 8, 2, INK, 39,
  );

  // Right: the nuclear space weapon warning.
  drawText(cv, 'SPACE - ALLIES WARN', rightX, midTop, 2, RED);
  drawText(cv, 'A WEAPON', rightX, midTop + 24, 5, INK);
  drawText(cv, 'IN ORBIT?', rightX, midTop + 24 + 38, 5, INK);
  let ry = drawWrapped(
    cv,
    'RUSSIA MAY LAUNCH NUCLEAR SPACE WEAPON NEXT MONTH',
    rightX, midTop + 24 + 38 + 38 + 6, 3, NAVY, 26,
  );
  ry = drawWrapped(
    cv,
    'NATO VOWED TO STRENGTHEN ITS SPACE DEFENCES AFTER REPORTS THAT MOSCOW IS PLANNING A LAUNCH WITHIN WEEKS THAT COULD DESTROY SATELLITES.',
    rightX, ry + 8, 2, INK, 39,
  );

  // Art panels sit below whichever column's text runs longer.
  const botRule = 800;
  const artTop = Math.max(ly, ry) + 10;
  const midArtH = botRule - 8 - artTop;
  drawWarship(cv, MARGIN, artTop, halfW, midArtH);
  drawSatellite(cv, rightX, artTop, halfW, midArtH);

  // ---- Divider ----------------------------------------------------------
  cv.hline(MARGIN, botRule, COLW, INK, 3);
  cv.hline(MARGIN, botRule + 6, COLW, INK, 1);

  // ---- Bottom row --------------------------------------------------------
  const botTop = 818;

  // Left: Kyiv region strikes.
  drawText(cv, 'KYIV REGION', MARGIN, botTop, 2, RED);
  let ky = drawWrapped(
    cv,
    'RUSSIAN STRIKES KILL AT LEAST 14',
    MARGIN, botTop + 24, 4, INK, 19,
  );
  ky = drawWrapped(
    cv,
    'NEW BARRAGES HIT THE KYIV REGION, UKRAINE SAID, AFTER PUTIN VOWED A "PAINFUL" RESPONSE TO DAMAGE TO THE CRIMEAN BRIDGE.',
    MARGIN, ky + 8, 2, INK, 39,
  );

  // Right: also today.
  drawText(cv, 'ALSO TODAY', rightX, botTop, 3, RED);
  cv.hline(rightX, botTop + 26, halfW, RED, 2);
  let ay = botTop + 38;
  const briefs = [
    'TRUMP SPEEDS UP FEDERAL EXECUTIONS.',
    'STATES SUE MUSK FIRMS OVER GROK.',
    'CHINA: DEATH SENTENCE FOR SPYING.',
    'MORE BODIES FOUND IN INDONESIA FIRE.',
    'DRONES HIT HOMES, UN SITE IN SUDAN.',
    "US TO HOST 2031 WOMEN'S WORLD CUP.",
  ];
  for (const b of briefs) {
    ay = drawBulletItem(cv, b, rightX, ay, 2, INK, 38, RED);
    ay += 3;
  }

  // ---- Footer ------------------------------------------------------------
  cv.hline(MARGIN, 980, COLW, INK, 2);
  drawTextCentered(
    cv,
    'AS REPORTED ON TUESDAY 24 NOVEMBER 2026 - AP, REUTERS, CNN, WSJ, SCMP',
    W / 2, 992, 2, GREY,
  );

  return cv;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  // Create the output directory if missing; never remove it.
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(drawPage());
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
