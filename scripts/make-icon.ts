/**
 * Rasterize the bunny-b mark (a lowercase b whose stem is one ear, a leaf ear floating beside it, and a little
 * ghost cut out of its face) into build/vaude.ico and build/vaude-256.png.
 * Pure Bun: a minimal PNG encoder (zlib via node:zlib + hand CRC) wrapped in an ICO container
 * (Vista+ ICOs embed PNG directly). No imagemagick, no deps - the five-line-helper doctrine.
 * The ICO carries 16-256px; 16-32 use a second drawing (bigger ghost and eyes, thicker ear) so he survives.
 */
import { deflateSync } from "node:zlib";
import { mkdir } from "node:fs/promises";

type Pt = [number, number];

const RED = { r: 0xe5, g: 0x60, b: 0x5e };
const SIZES = [16, 24, 32, 48, 64, 128, 256];

// -- the mark, in a 0..100 drawing space -------------------------------------------------------------

// The stem: a slab with a sloped tip whose foot meets the face disc (the b's bowl).
const STEM = "M22 8 C30 6 34 12 34 22 V52 L22 74 Z";
const FACE = { c: [48, 73.91] as Pt, r: 26 };
const EAR = "M40 40 C42 20 48 12 52 14 C56 16 52 30 46 44 Z";
// The ghost, drawn around (50, 55): a curled tip, a round head, a tail trailing off to the left.
const GHOST = "M60 21 C55 18.5 47.5 21 46.5 28 C34 30.5 25 40 26 53 C27 64 33 70 38 74 C42 77.5 41 84 33 90 C46 91.5 57 85 61 78 C70 72 75 62 74 50 C73 38 65 31 57 29.5 C56 26 57 22.5 60 21 Z";
const GHOST_EYES: Pt[] = [[43, 53], [57, 53]];

interface Drawing { s: number; at: Pt; eye: number; earGrow: number; frame: number }
const FULL: Drawing = { s: 0.46, at: [52, 73], eye: 1.9, earGrow: 0, frame: 0.92 };
const SMALL: Drawing = { s: 0.58, at: [53, 72], eye: 2.7, earGrow: 1.5, frame: 0.97 };

/** Flatten an absolute M/C/V/L/Z path into one polygon. */
function flatten(d: string): Pt[] {
  const tokens = d.match(/[MCVLZ]|-?[\d.]+/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = "";
  const num = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MCVLZ]/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (cmd === "Z") continue;
    if (cmd === "M" || cmd === "L") pts.push([num(), num()]);
    else if (cmd === "V") pts.push([pts[pts.length - 1]![0], num()]);
    else if (cmd === "C") {
      const p0 = pts[pts.length - 1]!;
      const [p1, p2, p3]: Pt[] = [[num(), num()], [num(), num()], [num(), num()]];
      for (let t = 1; t <= 16; t++) {
        const u = t / 16, v = 1 - u;
        pts.push([
          v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
        ]);
      }
    }
  }
  return pts;
}

function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a]!, [xb, yb] = poly[b]!;
    if (ya > p[1] !== yb > p[1] && p[0] < ((xb - xa) * (p[1] - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

function nearPoly(p: Pt, poly: Pt[], r: number): boolean {
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a]!, [xb, yb] = poly[b]!;
    const dx = xb - xa, dy = yb - ya;
    const t = Math.max(0, Math.min(1, ((p[0] - xa) * dx + (p[1] - ya) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(p[0] - xa - t * dx, p[1] - ya - t * dy) <= r) return true;
  }
  return false;
}

const stem = flatten(STEM);
const ear = flatten(EAR);
const ghostRaw = flatten(GHOST);

function painter(dr: Drawing): (p: Pt) => boolean {
  const place = ([x, y]: Pt): Pt => [dr.at[0] + (x - 50) * dr.s, dr.at[1] + (y - 55) * dr.s];
  const ghost = ghostRaw.map(place);
  const eyes = GHOST_EYES.map(place);
  return (p) => {
    if (eyes.some((e) => Math.hypot(p[0] - e[0], p[1] - e[1]) <= dr.eye)) return true;
    if (inPoly(p, ear) || (dr.earGrow > 0 && nearPoly(p, ear, dr.earGrow))) return true;
    const body = inPoly(p, stem) || Math.hypot(p[0] - FACE.c[0], p[1] - FACE.c[1]) <= FACE.r;
    return body && !inPoly(p, ghost);
  };
}

/** 4x supersampled coverage; the drawing is framed so its centre (48, 53.5) sits mid-tile. */
function render(size: number): Uint8Array {
  const dr = size <= 32 ? SMALL : FULL;
  const paint = painter(dr);
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const u = ((x + (sx + 0.5) / 4) / size) * 100;
          const v = ((y + (sy + 0.5) / 4) / size) * 100;
          if (paint([48 + (u - 50) / dr.frame, 53.5 + (v - 50) / dr.frame])) hit++;
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = RED.r;
      rgba[i + 1] = RED.g;
      rgba[i + 2] = RED.b;
      rgba[i + 3] = Math.round((hit / 16) * 255); // transparent ground; the mark floats
    }
  }
  return rgba;
}

// -- raw RGBA -> PNG --------------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(rgba: Uint8Array, size: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = new Uint8Array((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  const idat = new Uint8Array(deflateSync(raw));
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, part) => n + part.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    png.set(part, off);
    off += part.length;
  }
  return png;
}

/** ICO container: one PNG-compressed entry per size (Vista+). */
function wrapIco(pngs: Uint8Array[], sizes: number[]): Uint8Array {
  const head = 6 + 16 * pngs.length;
  const out = new Uint8Array(head + pngs.reduce((n, p) => n + p.length, 0));
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true); // type: icon
  dv.setUint16(4, pngs.length, true); // count
  let off = head;
  pngs.forEach((png, i) => {
    const e = 6 + i * 16;
    out[e] = sizes[i]! >= 256 ? 0 : sizes[i]!; // 0 = 256px
    out[e + 1] = out[e]!;
    dv.setUint16(e + 4, 1, true); // planes
    dv.setUint16(e + 6, 32, true); // bpp
    dv.setUint32(e + 8, png.length, true);
    dv.setUint32(e + 12, off, true);
    out.set(png, off);
    off += png.length;
  });
  return out;
}

await mkdir("build", { recursive: true });
const pngs = SIZES.map((size) => encodePng(render(size), size));
const ico = wrapIco(pngs, SIZES);
await Bun.write("build/vaude-256.png", pngs[SIZES.indexOf(256)]!);
await Bun.write("build/vaude.ico", ico);
console.log(`wrote build/vaude.ico (${ico.length}b, ${SIZES.join("/")}px) + build/vaude-256.png`);
