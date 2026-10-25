/**
 * Shared seeded-synthetic building blocks for every `scripts/scale/fixtures/<kind>.ts` generator:
 * deterministic vocabulary prose (never
 * real user text) and a deterministic, valid, minimal PNG built to an approximate target byte
 * size. Underscore-prefixed so `fixtures.test.ts`'s per-kind scan skips it, the same convention
 * `src/entities/_shared/` and `storage-shape-tripwire.test.ts` already use.
 */
import { deflateSync } from "node:zlib";
import { mulberry32 } from "../../../src/core/lore/rng";
import { bytesToBase64 } from "../../../src/core/base64";
import { sampleWords } from "../word-sampler";

export { mulberry32 };

/** A closed, theatrical vocabulary: enough words that repeated sentences do not look identical,
 * never anything resembling a real author's prose. */
const VOCAB = [
  "lantern", "archive", "threshold", "cipher", "rehearsal", "understudy", "matinee", "curtain",
  "ledger", "chorus", "rigging", "proscenium", "footlight", "stagehand", "script", "cue", "gallery",
  "vestibule", "corridor", "atrium", "balcony", "catwalk", "scrim", "gauze", "backdrop", "flywall",
  "greenroom", "prompter", "overture", "intermission", "encore", "tableau", "marquee", "playbill",
  "understage", "wardrobe", "props", "spotlight", "houselights", "apron", "wings", "fresnel", "gel",
  "trapdoor", "batten", "rosin", "callboard", "runsheet", "cyclorama", "grip", "flat", "borderlight",
] as const;

/** One deterministic sentence of `words` vocabulary words. */
export function sentence(rng: () => number, words: number): string {
  const s = sampleWords(rng, VOCAB, words).join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

/** How much seed text `paragraph` builds sentence by sentence before tiling the rest: large enough
 * that the tiling is not visibly repetitive within one screen, small enough that even a 20 MB target
 * costs one seed's worth of random-word work, not the whole target's. */
const PARAGRAPH_SEED_CHARS = 4_000;

/**
 * Deterministic synthetic prose of about `targetChars` characters. Builds one seed block sentence by
 * sentence (bounded work, `PARAGRAPH_SEED_CHARS`), then tiles it to size with native string
 * `repeat`/`slice` - a multi-megabyte character body or filler chunk is then a handful of
 * allocations, not tens of thousands of small random-word picks, which is what kept the small N a
 * fast gate uses from running in seconds (measured: 1,000 1-3 MB bodies took over 30 s sentence by
 * sentence, under 1 s tiled).
 */
export function paragraph(rng: () => number, targetChars: number): string {
  let seed = "";
  while (seed.length < Math.min(targetChars, PARAGRAPH_SEED_CHARS)) {
    seed += (seed ? " " : "") + sentence(rng, 8 + Math.floor(rng() * 6));
  }
  if (targetChars <= seed.length) return seed.slice(0, targetChars);
  return seed.repeat(Math.ceil(targetChars / seed.length)).slice(0, targetChars);
}

// ---- Synthetic PNG art: a real, tiny, decodable image padded to a target size with a filler tEXt
// chunk of the same vocabulary prose - the same reason a real exported card's `chara`/`ccv3` JSON
// chunk dominates its file size, so the shape (one small pixel core, most of the bytes in metadata)
// matches what a real oversized card actually looks like. Never committed as a binary: built fresh
// at gate/test time from these few dozen lines.
//
// Hand-rolled chunk framing rather than the `png-chunks-encode` dependency `src/formats/_shared/
// png.ts` uses for reading real cards: that library's CRC32 took 655 ms per 2 MB filler chunk
// (measured), which alone blew the "small N runs in seconds" budget at a few dozen portraits. The
// table-based CRC32 below does the same 2 MB in under 10 ms - PNG chunk framing (length, type, data,
// CRC32 of type+data) is a fixed, tiny format, not logic worth a dependency here. ----

/** Table-based CRC32 (the zlib/PNG polynomial): O(n) with a small constant, unlike a naive per-bit
 * implementation - the difference that made filler-chunk generation fast enough for this file's job. */
const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: 4-byte length, 4-byte type, the data, then a CRC32 of type+data. */
function pngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdrChunk(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8; // bit depth
  data[9] = 2; // color type: RGB
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return pngChunk("IHDR", data);
}

function idatChunk(width: number, height: number, rng: () => number): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = Math.floor(rng() * 256);
  }
  return pngChunk("IDAT", deflateSync(raw));
}

/** A `tEXt` chunk: "keyword\0text", the plain-Latin-1 form every PNG reader accepts. */
function textChunk(keyword: string, value: string): Buffer {
  return pngChunk("tEXt", Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(value, "latin1")]));
}

const iendChunk = (): Buffer => pngChunk("IEND", new Uint8Array(0));

/** A deterministic, valid, minimal PNG of about `targetBytes`: a real 8x8 pixel core plus a
 * `scaleFiller` tEXt chunk of vocabulary prose padding it to size. */
export function syntheticPngBytes(rng: () => number, targetBytes: number): Uint8Array {
  const core = Buffer.concat([PNG_SIGNATURE, ihdrChunk(8, 8), idatChunk(8, 8, rng), iendChunk()]);
  const KEYWORD = "scaleFiller";
  const fillerChars = Math.max(0, targetBytes - core.length - (12 + KEYWORD.length + 1));
  if (fillerChars === 0) return new Uint8Array(core);
  const filler = textChunk(KEYWORD, paragraph(rng, fillerChars));
  return new Uint8Array(
    Buffer.concat([PNG_SIGNATURE, ihdrChunk(8, 8), idatChunk(8, 8, rng), filler, iendChunk()]),
  );
}

/** The same synthetic PNG, as a `data:image/png;base64,...` URI - the shape every media ref here
 * carries (portraits, sprites, backgrounds). */
export function syntheticPngDataUri(rng: () => number, targetBytes: number): string {
  return `data:image/png;base64,${bytesToBase64(syntheticPngBytes(rng, targetBytes))}`;
}
