/**
 * PNG character-card codec: read/write the base64 `chara` (V2) and `ccv3` (V3) tEXt chunks.
 * Shared by every Tavern-lineage PNG format (SillyTavern, RoleCall). Adapted from RoleCall's
 * formats/png/writer.ts - logic kept, DOM download helpers dropped, browser
 * shared runtime-neutral base64 helpers.
 */
import extract from "png-chunks-extract";
import encode from "png-chunks-encode";
import text from "png-chunk-text";
import { base64ToBytes, base64ToUtf8, bytesToBase64, utf8ToBase64 } from "../../core/base64";
import { isPngBytes } from "../../core/bytes";

const b64encode = utf8ToBase64;
const b64decode = base64ToUtf8;

const isTextChunk = (name: string): boolean => name === "tEXt" || name === "iTXt";

/** extract() but tolerant: non-PNG (or corrupt) bytes yield [] instead of throwing. */
function safeExtract(png: Uint8Array): ReturnType<typeof extract> {
  if (!isPngBytes(png)) return [];
  try {
    return extract(png);
  } catch {
    return [];
  }
}

/** Visit decodable PNG text chunks from tolerant card readers until one accepts a value. */
function forEachTextChunk(png: Uint8Array, visit: (keyword: string, value: string) => boolean | void): void {
  for (const chunk of safeExtract(png)) {
    if (!isTextChunk(chunk.name)) continue;
    try {
      const { keyword, text: value } = text.decode(chunk.data);
      if (visit(keyword, value)) return;
    } catch {
      continue;
    }
  }
}

/**
 * The original sourceMedia twin for a PNG-carried card: the pixels are authored art, so every
 * Tavern-lineage PNG adapter keeps the carrier. Returns undefined for non-PNG input (tolerant).
 */
export function pngSourceMedia(bytes: Uint8Array | undefined): { b64: string; mime: string } | undefined {
  if (!bytes || !isPngBytes(bytes)) return undefined;
  return { b64: bytesToBase64(bytes), mime: "image/png" };
}

/**
 * Return the decoded character JSON string from a PNG, or null if none present.
 *
 * A V3 card is normally written with BOTH chunks: `ccv3` carrying the full card and `chara` carrying
 * a V2 subset for older readers. Chunk order is not specified, so preferring whichever came first
 * would silently downgrade such a card to its subset. Prefer `ccv3` wherever it exists, matching
 * getVersion below; the two must never disagree about which chunk they are describing.
 */
export function extractCharacterJson(png: Uint8Array): string | null {
  let fallback: string | null = null;
  let preferred: string | null = null;
  forEachTextChunk(png, (keyword, value) => {
    try {
      if (keyword === "ccv3") {
        preferred = b64decode(value);
        return true;
      }
      if (keyword === "chara" && fallback === null) fallback = b64decode(value);
    } catch {
      return;
    }
  });
  return preferred ?? fallback;
}

/** "v3" if a ccv3 chunk exists, else "v2" if a chara chunk exists, else null. */
export function getVersion(png: Uint8Array): "v2" | "v3" | null {
  let version: "v2" | "v3" | null = null;
  forEachTextChunk(png, (keyword) => {
    if (keyword === "ccv3") { version = "v3"; return true; }
    if (keyword === "chara") version = "v2";
  });
  return version;
}

/** Replace prior character chunks and insert each new chunk immediately before IEND. */
function replaceCharacterChunks(png: Uint8Array, values: readonly [string, string][]): Uint8Array {
  const chunks = extract(png).filter((chunk) => {
    if (!isTextChunk(chunk.name)) return true;
    try {
      const { keyword: k } = text.decode(chunk.data);
      return k !== "chara" && k !== "ccv3";
    } catch {
      return true;
    }
  });
  const iend = chunks.findIndex((c) => c.name === "IEND");
  const cardChunks = values.map(([keyword, json]) => text.encode(keyword, b64encode(json)));
  if (iend !== -1) chunks.splice(iend, 0, ...cardChunks);
  else chunks.push(...cardChunks);
  return encode(chunks);
}

/** Embed character JSON into a carrier PNG under the given keyword (default "chara"). */
export function embedCharacterJson(png: Uint8Array, json: string, keyword = "chara"): Uint8Array {
  return replaceCharacterChunks(png, [[keyword, json]]);
}

const CANONICAL_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * The card's portrait as raw PNG bytes, or null when it cannot carry one.
 *
 * A PNG CARD IS ITS PORTRAIT. Both adapters that write one need exactly this, and it was defined
 * privately in pygmalion while sillytavern - the format people actually trade PNGs in - could not
 * write one at all. Shared rather than copied: two readers of `data:` URLs drifting apart is how one
 * format quietly starts accepting a portrait the other rejects.
 *
 * INLINE PNG ONLY, and strictly. No fetching a remote ref, no transcoding another image type: an
 * export must not reach the network, and re-encoding pixels would make the round trip lossy without
 * saying so. The base64 is round-tripped before it is trusted, so a truncated or re-wrapped data URL
 * fails here rather than producing a corrupt carrier somebody discovers in another app.
 */
export function portraitPngBytes(body: { media: { portrait?: { ref?: unknown } } }): Uint8Array | null {
  const ref = body.media.portrait?.ref;
  if (typeof ref !== "string") return null;
  const match = /^data:image\/png;base64,(.+)$/i.exec(ref);
  const encoded = match?.[1];
  if (!encoded || encoded.length % 4 !== 0 || !CANONICAL_BASE64.test(encoded)) return null;
  try {
    const bytes = base64ToBytes(encoded);
    if (bytesToBase64(bytes) !== encoded) return null;
    const chunks = safeExtract(bytes);
    return chunks.some((chunk) => chunk.name === "IHDR") && chunks.some((chunk) => chunk.name === "IEND")
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * Embed a card into its portrait, under the keywords readers actually look for.
 *
 * ONE IMPLEMENTATION, because "write a card into a PNG" is not a property of any one format. Both
 * writers had their own copy of this decision and they disagreed: a v3 card went out labelled v2
 * for a commit, because only one of them knew about `ccv3`.
 *
 * A v3 card carries the full JSON under `ccv3` and a V2-shaped backfill under `chara`. Anything
 * else carries `chara` alone, which is what it is.
 */
export function embedCardPng(portrait: Uint8Array, charaJson: string, ccv3Json?: string): Uint8Array {
  const chunks: [string, string][] = ccv3Json === undefined
    ? [["chara", charaJson]]
    : [["ccv3", ccv3Json], ["chara", charaJson]];
  return replaceCharacterChunks(portrait, chunks);
}
