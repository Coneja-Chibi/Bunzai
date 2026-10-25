/**
 * The one place file signatures are read. Every door that decides "is this a ZIP / a PNG" calls
 * these, so a card sniffer, an upload validator and the agent's image door cannot disagree about
 * how much of a signature has to be present (AGENTS.md rule 12).
 */

/** True when `bytes` carries `magic` starting at `at`. Input shorter than the magic never matches. */
export const startsWith = (bytes: Uint8Array, magic: readonly number[], at = 0): boolean =>
  magic.every((byte, i) => bytes[at + i] === byte);

const ZIP_PK = [0x50, 0x4b] as const;
/** Local file header, empty archive (end-of-central-directory first) and spanned-archive marker. */
const ZIP_KINDS: readonly (readonly [number, number])[] = [[0x03, 0x04], [0x05, 0x06], [0x07, 0x08]];

/** True when the bytes open with a ZIP signature (a .zip, .charx, .byaf, .lvbak container). */
export const isZipBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 && startsWith(bytes, ZIP_PK) && ZIP_KINDS.some(([a, b]) => bytes[2] === a && bytes[3] === b);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** True only when the bytes begin with the whole eight-byte PNG signature. */
export const isPngBytes = (bytes: Uint8Array): boolean => startsWith(bytes, PNG_SIGNATURE);
