/**
 * Read a Tavern-lineage card's JSON out of adapter input: from a PNG chara/ccv3 chunk when the
 * input is bytes, or from raw text otherwise. Shared by SillyTavern and RoleCall (both accept
 * png-or-json). Tolerant: returns null on anything that is not a parseable card, never throws.
 */
import type { AdapterInput } from "../../core/adapter";
import { extractCharacterJson } from "./png";
import { isRecord } from "../../core/guards";

/**
 * ONE DECODE PER FILE, SHARED BY EVERY ADAPTER THAT SNIFFS IT.
 *
 * Detection asks every registered adapter what a file looks like, and each one used to decode and
 * parse the same bytes for itself. Measured in-process on a real 11.3 MB Miki.png (29
 * registered adapters, `registry.detect` then the winner's `toCanonical`): `inspectBytes` fell from
 * 3.35-3.63s (22 `TextDecoder.decode` calls) to 0.39-0.40s (1 call).
 * Most adapters are not PNG-aware and simply try to read whatever bytes they are handed as JSON.
 *
 * WeakMaps keyed on the input object, not caches with a lifetime: each memo lasts exactly as long
 * as the input it describes and disappears with it, so there is nothing to invalidate and no way to
 * answer about a file that has since changed. An entry is stored even when decoding or parsing
 * FAILS, because "this is not JSON" is just as expensive to rediscover twenty-eight times and just
 * as stable.
 *
 * Holds only while nobody rewrites `input.text` in place. Nothing does: the input is built once, at
 * the boundary, and adapters read it.
 */
type Box<T> = { readonly value: T };

/** `input.bytes` decoded to text, once. When `toAdapterInput` already set `input.text` (the text
 * extensions), that is free and this never touches `TextDecoder`. */
const decodedBytes = new WeakMap<AdapterInput, string>();

function decodeBytesOnce(input: AdapterInput): string | null {
  if (input.text != null) return input.text;
  if (!input.bytes) return null;
  const cached = decodedBytes.get(input);
  if (cached !== undefined) return cached;
  const decoded = new TextDecoder().decode(input.bytes);
  decodedBytes.set(input, decoded);
  return decoded;
}

/** A decoded text's JSON.parse, once. Shared shape for both the plain-text and PNG-chunk text,
 * kept as separate memos below - see the "different document" note on `parsePngTextOnce`. */
function parseOnceInto(memo: WeakMap<AdapterInput, Box<unknown> | null>, input: AdapterInput, text: string): Box<unknown> | null {
  const seen = memo.get(input);
  if (seen !== undefined) return seen;
  let box: Box<unknown> | null = null;
  try {
    box = { value: JSON.parse(text) as unknown };
  } catch {
    box = null;
  }
  memo.set(input, box);
  return box;
}

/** The plain-text document's parsed JSON, once. Boxed so a legitimate `null` document is not a
 * cache miss. */
const parsedText = new WeakMap<AdapterInput, Box<unknown> | null>();

/** The PNG chara/ccv3 chunk's raw JSON string, once. `null` covers both "not a PNG" and "no
 * chara/ccv3 chunk" - both as expensive to rediscover as to remember. */
const pngChunkText = new WeakMap<AdapterInput, string | null>();

function extractPngTextOnce(input: AdapterInput): string | null {
  if (!input.bytes) return null;
  const cached = pngChunkText.get(input);
  if (cached !== undefined) return cached;
  const extracted = extractCharacterJson(input.bytes);
  pngChunkText.set(input, extracted);
  return extracted;
}

/** The PNG chunk's JSON, parsed once. A SEPARATE memo from `parsedText`: a PNG's embedded chunk is
 * a DIFFERENT document from the input's own text, and sharing one entry between them would hand
 * the wrong JSON to whichever reader asked second. */
const parsedPngText = new WeakMap<AdapterInput, Box<unknown> | null>();

export function readCardJson(input: AdapterInput): unknown | null {
  // Try the PNG chara/ccv3 chunk first; a real .json read carries BOTH bytes and decoded text, so
  // fall through to text when the bytes are not a card-bearing PNG (do NOT stop at the bytes branch).
  const pngText = extractPngTextOnce(input);
  if (pngText !== null) return parseOnceInto(parsedPngText, input, pngText)?.value ?? null;
  if (input.text == null) return null;
  return parseOnceInto(parsedText, input, input.text)?.value ?? null;
}

/**
 * Decode plain json input (text, or non-PNG bytes) to ANY parsed JSON value, or null. The
 * shape-agnostic sibling of readJsonObject for readers whose wire is not an object (the regex
 * codecs accept bare arrays). Tolerant: never throws, null on undecodable input.
 */
export function readJsonAny(input: AdapterInput): unknown | null {
  const text = decodeBytesOnce(input);
  if (text == null) return null;
  return parseOnceInto(parsedText, input, text)?.value ?? null;
}

/**
 * Decode plain json input (text, or non-PNG bytes) to an object, or null. The un-PNG'd sibling of
 * readCardJson: the shared decode+parse+object-check boundary the standalone lorebook readers layer
 * their own shape guard on. Tolerant: never throws, null on anything that is not a json object.
 */
export function readJsonObject(input: AdapterInput): Record<string, unknown> | null {
  const json = readJsonAny(input);
  return isRecord(json) ? json : null;
}
