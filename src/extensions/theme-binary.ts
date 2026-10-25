/**
 * Binary theme files (PNG, WebP, woff2) travel as canonical base64 inside the JSON package. Each is decoded once
 * here and checked structurally: signature, chunk lengths and checksums, an allowlist of chunk types, bounded
 * dimensions, no animation, no trailing bytes. The browser still decodes them in its own sandbox; this refuses
 * what could not be a plain still image or font before it is ever stored or served.
 */
export type BinaryMedia = "image/png" | "image/webp" | "font/woff2";
export const MAX_RASTER_BYTES = 128_000;
export const MAX_FONT_BYTES = 128_000;
const MAX_SIDE = 4096;
const MAX_PIXELS = 4_000_000;

const fail = (): never => { throw new Error("invalid theme package"); };
const u32be = (b: Uint8Array, at: number): number => (((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0);
const u32le = (b: Uint8Array, at: number): number => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
const ascii = (b: Uint8Array, at: number, n: number): string => String.fromCharCode(...b.subarray(at, at + n));

/** The one decoder: refuses padding or alphabet variants, so a file has exactly one text form (and one digest). */
export function decodeCanonicalBase64(text: string): Uint8Array<ArrayBuffer> {
  if (text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return fail();
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  let back = "";
  for (let i = 0; i < bytes.length; i += 0x2000) back += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  return btoa(back) === text ? bytes : fail();
}

let crcTable: Uint32Array | undefined;
export function crc32(b: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const sizeOk = (w: number, h: number): boolean => w >= 1 && h >= 1 && w <= MAX_SIDE && h <= MAX_SIDE && w * h <= MAX_PIXELS;

const PNG_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "sBIT", "bKGD", "pHYs"]);
function checkPng(b: Uint8Array): void {
  if (b.length < 57 || ascii(b, 0, 8) !== "\x89PNG\r\n\x1a\n") fail();
  let at = 8, idat = 0;
  for (let first = true; ; first = false) {
    if (at + 12 > b.length) fail();
    const len = u32be(b, at), type = ascii(b, at + 4, 4);
    if (len > b.length || at + 12 + len > b.length || !PNG_CHUNKS.has(type) || (first && type !== "IHDR") || (!first && type === "IHDR")) fail();
    if (crc32(b.subarray(at + 4, at + 8 + len)) !== u32be(b, at + 8 + len)) fail();
    if (type === "IHDR" && (len !== 13 || !sizeOk(u32be(b, at + 8), u32be(b, at + 12)))) fail();
    if (type === "IDAT") idat++;
    at += 12 + len;
    if (type === "IEND") { if (len !== 0 || at !== b.length || idat === 0) fail(); return; }
  }
}

const WEBP_CHUNKS = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP"]);
function checkWebp(b: Uint8Array): void {
  if (b.length < 20 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP" || u32le(b, 4) !== b.length - 8) fail();
  let at = 12, dims = false, image = false;
  while (at < b.length) {
    if (at + 8 > b.length) fail();
    const type = ascii(b, at, 4), len = u32le(b, at + 4), body = at + 8;
    if (!WEBP_CHUNKS.has(type) || body + len > b.length) fail();
    if (at === 12 && !["VP8 ", "VP8L", "VP8X"].includes(type)) fail();
    if (type === "VP8X") {
      if (len !== 10 || (b[body]! & 0x02) !== 0 || dims) fail();
      dims = sizeOk(1 + (b[body + 4]! | (b[body + 5]! << 8) | (b[body + 6]! << 16)), 1 + (b[body + 7]! | (b[body + 8]! << 8) | (b[body + 9]! << 16)));
      if (!dims) fail();
    } else if (type === "VP8L") {
      if (len < 5 || b[body] !== 0x2f) fail();
      const bits = u32le(b, body + 1);
      if (!sizeOk((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)) fail();
      image = true;
    } else if (type === "VP8 ") {
      if (len < 10 || b[body + 3] !== 0x9d || b[body + 4] !== 0x01 || b[body + 5] !== 0x2a) fail();
      if (!sizeOk((b[body + 6]! | (b[body + 7]! << 8)) & 0x3fff, (b[body + 8]! | (b[body + 9]! << 8)) & 0x3fff)) fail();
      image = true;
    }
    at = body + len + (len & 1);
  }
  if (at !== b.length || !image) fail();
}

function checkWoff2(b: Uint8Array): void {
  if (b.length < 48 || ascii(b, 0, 4) !== "wOF2" || u32be(b, 8) !== b.length) fail();
  const flavor = u32be(b, 4), tables = (b[12]! << 8) | b[13]!;
  if (![0x00010000, 0x4f54544f].includes(flavor) || tables < 1 || tables > 64 || (b[14]! | b[15]!) !== 0) fail();
  const sfnt = u32be(b, 16);
  if (sfnt < 12 || sfnt > 4_000_000) fail();
}

/** Decode and check one binary file of the declared media type; returns its bytes. */
export function checkBinary(media: BinaryMedia, base64: string): Uint8Array<ArrayBuffer> {
  const bytes = decodeCanonicalBase64(base64);
  if (bytes.length > (media === "font/woff2" ? MAX_FONT_BYTES : MAX_RASTER_BYTES)) fail();
  if (media === "image/png") checkPng(bytes); else if (media === "image/webp") checkWebp(bytes); else checkWoff2(bytes);
  return bytes;
}
