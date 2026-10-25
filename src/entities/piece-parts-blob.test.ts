/**
 * Red tests for piece-parts-blob.ts's sentinel rules: the 16 KB blob threshold on both sides, data-URI and bare-base64 dedup keys, the
 * non-canonical-base64 text fallback, escrow-only text extraction, and the escaping rule that keeps
 * an authored string starting with the sentinel prefix unchanged through a round trip.
 */
import { describe, expect, test } from "bun:test";
import { base64ToBytes, bytesToBase64 } from "../core/base64";
import { hashHex } from "../core/sha256";
import { BLOB_THRESHOLD, SENTINEL_PREFIX, decodeBlobs, encodeBlobs, parseUploadedRef } from "./piece-parts-blob";

function roundTrip(value: unknown, allowTextFallback: boolean): unknown {
  const blobs = new Map<string, import("./piece-parts-blob").PartBlob>();
  const encoded = encodeBlobs(value, allowTextFallback, blobs);
  return decodeBlobs(encoded, blobs);
}

describe("the 16 KB blob threshold: >= extracts, < stays inline", () => {
  test("a canonical bare-base64 string exactly at the threshold extracts", () => {
    // 16,384 chars, a multiple of 4, no padding needed: 12,288 bytes re-encode to exactly this.
    const bytes = new Uint8Array(12_288).fill(7);
    const b64 = bytesToBase64(bytes);
    expect(b64.length).toBe(BLOB_THRESHOLD);
    const blobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const encoded = encodeBlobs(b64, false, blobs) as string;
    expect(encoded.startsWith(`${SENTINEL_PREFIX}b:`)).toBe(true);
    expect(blobs.size).toBe(1);
    expect(decodeBlobs(encoded, blobs)).toBe(b64);
  });

  test("one character under the threshold stays inline, even as canonical base64", () => {
    const bytes = new Uint8Array(12_285).fill(7); // encodes to 16,380 chars, still %4 == 0
    const b64 = bytesToBase64(bytes);
    expect(b64.length).toBeLessThan(BLOB_THRESHOLD);
    const blobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const encoded = encodeBlobs(b64, false, blobs);
    expect(encoded).toBe(b64);
    expect(blobs.size).toBe(0);
  });

  test("escrow-only text rule (c): a 16,384-char plain string extracts inside escrow, stays inline outside it", () => {
    const text = "the quick brown fox ".repeat(1000).slice(0, BLOB_THRESHOLD);
    expect(text.length).toBe(BLOB_THRESHOLD);
    const inEscrow = roundTrip(text, true);
    const outsideEscrow = roundTrip(text, false);
    expect(inEscrow).toBe(text);
    expect(outsideEscrow).toBe(text);
    const escrowBlobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    encodeBlobs(text, true, escrowBlobs);
    expect(escrowBlobs.size).toBe(1);
    const bodyBlobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    encodeBlobs(text, false, bodyBlobs);
    expect(bodyBlobs.size).toBe(0); // prose outside escrow never extracts (body text stays inline)
  });
});

describe("dedup keys: rule (a) data URI and rule (b) bare base64 share one blob for the same bytes", () => {
  test("a data URI and its bare-base64 payload hash to the same key", () => {
    const bytes = new Uint8Array(12_288).fill(3);
    const b64 = bytesToBase64(bytes);
    const dataUri = `data:image/png;base64,${b64}`;
    const dataBlobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const bareBlobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    encodeBlobs(dataUri, false, dataBlobs);
    encodeBlobs(b64, false, bareBlobs);
    expect([...dataBlobs.keys()]).toEqual([...bareBlobs.keys()]);
    expect([...dataBlobs.keys()][0]).toBe(hashHex(bytes));
  });

  test("a data URI round-trips to the exact original string, mime included", () => {
    const bytes = new Uint8Array(12_288).fill(9);
    const dataUri = `data:image/png;base64,${bytesToBase64(bytes)}`;
    expect(roundTrip(dataUri, false)).toBe(dataUri);
  });
});

describe("non-canonical base64 falls back to the text form (not shared, but correct)", () => {
  test("a base64-shaped string whose padding does not round-trip uses rule (t), only inside escrow", () => {
    // "QR==" decodes to one byte and re-encodes to "QQ==" - same shape, different string: non-canonical.
    const nonCanonical = "A".repeat(16_380) + "QR==";
    expect(nonCanonical.length).toBe(BLOB_THRESHOLD);
    expect(bytesToBase64(base64ToBytes(nonCanonical))).not.toBe(nonCanonical);

    const escrowBlobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const encodedInEscrow = encodeBlobs(nonCanonical, true, escrowBlobs) as string;
    expect(encodedInEscrow.startsWith(`${SENTINEL_PREFIX}t:`)).toBe(true); // not "b:": not shared
    expect(decodeBlobs(encodedInEscrow, escrowBlobs)).toBe(nonCanonical);

    // Outside escrow, rule (c) does not apply, and it failed rule (b): stays inline (escaped only
    // if it happened to start with the sentinel prefix, which it does not here).
    const bodyBlobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    expect(encodeBlobs(nonCanonical, false, bodyBlobs)).toBe(nonCanonical);
    expect(bodyBlobs.size).toBe(0);
  });
});

describe("sentinel escaping: an authored string starting with the prefix survives unchanged", () => {
  test("a short authored string", () => {
    const authored = `${SENTINEL_PREFIX}hello`;
    expect(roundTrip(authored, false)).toBe(authored);
  });

  test("a long (>= threshold) authored string that is not base64 or a data URI", () => {
    const authored = SENTINEL_PREFIX + "not base64 prose, with spaces. ".repeat(600);
    expect(authored.length).toBeGreaterThanOrEqual(BLOB_THRESHOLD);
    expect(roundTrip(authored, false)).toBe(authored); // outside escrow: never extracted, only escaped
  });

  test("a perfect fake matching the real sentinel grammar exactly", () => {
    const fake = `${SENTINEL_PREFIX}t:${"0".repeat(64)}`;
    const blobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const encoded = encodeBlobs(fake, false, blobs) as string;
    expect(encoded).toBe(SENTINEL_PREFIX + fake); // doubled, not left as the ambiguous single form
    expect(blobs.size).toBe(0);
    expect(decodeBlobs(encoded, blobs)).toBe(fake);
  });

  test("a string already starting with a doubled prefix round-trips through one more layer", () => {
    const authored = SENTINEL_PREFIX + SENTINEL_PREFIX + "foo";
    expect(roundTrip(authored, false)).toBe(authored);
  });

  test("escaping applies inside an escrow payload too, alongside genuine extraction", () => {
    const fake = `${SENTINEL_PREFIX}b:${"1".repeat(64)}`;
    const big = { fake, filler: "z".repeat(BLOB_THRESHOLD) };
    const blobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const encoded = encodeBlobs(big, true, blobs) as { fake: string; filler: string };
    expect(encoded.fake).toBe(SENTINEL_PREFIX + fake); // escaped, not treated as a reference
    expect(decodeBlobs(encoded, blobs)).toEqual(big);
  });

  test("lone surrogates stay inline rather than hash a lossy UTF-8 reencoding", () => {
    const illFormed = "\uD800" + "x".repeat(BLOB_THRESHOLD); // an unpaired high surrogate
    expect(illFormed.isWellFormed()).toBe(false);
    const blobs = new Map<string, import("./piece-parts-blob").PartBlob>();
    const encoded = encodeBlobs(illFormed, true, blobs); // even inside escrow
    expect(encoded).toBe(illFormed);
    expect(blobs.size).toBe(0);
  });
});

describe("S4b: a shared blob stored under one payload kind resolves to every sentinel kind that asks for it", () => {
  // Two different parts can extract the SAME content once as rule (b)/(u) bytes and once as rule (c)
  // text (an escrow string that happens to equal another part's base64 payload byte-for-byte): the
  // backend's own blob row holds only one payload shape, so whichever sentinel opens it second must
  // not see "no such blob" just because the stored shape does not match its own letter.
  test("hashHex of a string equals hashHex of its own UTF-8 bytes (the premise the backend's shaOf relies on)", () => {
    // `sqlite/blob-sql.ts`'s `shaOf` (node:crypto, hashing a payload's identity bytes on open) must
    // land on the exact same digest `hashHex` (Bun.CryptoHasher, used when a sentinel's key is first
    // minted here) does for the same content, or every text blob would open as "unresolved" the moment
    // it is read back from storage. Covers non-ASCII too: a mismatch here would most likely show up
    // only on a multi-byte string, since UTF-8 and a naive byte read of a string agree for ASCII.
    const text = "café 日本語 prose ".repeat(100);
    expect(hashHex(text)).toBe(hashHex(new TextEncoder().encode(text)));
  });

  test("a bytes-shaped blob answers a text sentinel for the same key", () => {
    const bytes = new TextEncoder().encode("the quick brown fox ".repeat(900));
    const sha = hashHex(bytes);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const blobsByKey = new Map([[sha, { key: sha, payload: { kind: "bytes" as const, bytes } }]]);
    expect(decodeBlobs(`${SENTINEL_PREFIX}t:${sha}`, blobsByKey)).toBe(text);
  });

  test("a bytes-shaped blob keeps a leading BOM when a text sentinel reads it", () => {
    // TextDecoder drops a leading U+FEFF by default; SillyTavern exports often start with one.
    const text = "﻿" + "a card note ".repeat(1500);
    const bytes = new TextEncoder().encode(text);
    const sha = hashHex(bytes);
    const blobsByKey = new Map([[sha, { key: sha, payload: { kind: "bytes" as const, bytes } }]]);
    expect(decodeBlobs(`${SENTINEL_PREFIX}t:${sha}`, blobsByKey)).toBe(text);
  });

  test("a text-shaped blob answers a bare-base64 sentinel for the same key", () => {
    const bytes = new TextEncoder().encode("the quick brown fox ".repeat(900));
    const sha = hashHex(bytes);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const blobsByKey = new Map([[sha, { key: sha, payload: { kind: "text" as const, text } }]]);
    expect(decodeBlobs(`${SENTINEL_PREFIX}b:${sha}`, blobsByKey)).toBe(bytesToBase64(bytes));
  });

  test("a text-shaped blob answers a data-URI sentinel for the same key", () => {
    const bytes = new TextEncoder().encode("the quick brown fox ".repeat(900));
    const sha = hashHex(bytes);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const blobsByKey = new Map([[sha, { key: sha, payload: { kind: "text" as const, text } }]]);
    expect(decodeBlobs(`${SENTINEL_PREFIX}u:image/png:${sha}`, blobsByKey)).toBe(`data:image/png;base64,${bytesToBase64(bytes)}`);
  });
});

describe("mayNeedBlobWalk gate", () => {
  test("a part json with no NUL escape needs no walk", async () => {
    const { mayNeedBlobWalk } = await import("./piece-parts-blob");
    expect(mayNeedBlobWalk(JSON.stringify({ a: "plain text", b: 1 }))).toBe(false);
  });

  test("a part json carrying a sentinel needs a walk", async () => {
    const { mayNeedBlobWalk } = await import("./piece-parts-blob");
    expect(mayNeedBlobWalk(JSON.stringify({ a: `${SENTINEL_PREFIX}t:${"0".repeat(64)}` }))).toBe(true);
  });
});

describe("parseUploadedRef: the one reader of an uploaded-media reference", () => {
  const sha = "a".repeat(64);
  const ref = (mime: string): string => `${SENTINEL_PREFIX}u:${mime}:${sha}`;

  test("reads the media type and the hash", () => {
    expect(parseUploadedRef(ref("image/png"))).toEqual({ mime: "image/png", sha });
    expect(parseUploadedRef(ref("video/mp4"))).toEqual({ mime: "video/mp4", sha });
  });

  test("a media type the writer produced is read whole, whatever characters it holds", () => {
    // The UI used to carry copies that stopped at the first ":" or allowed only [A-Za-z0-9.+-].
    expect(parseUploadedRef(ref("image/vnd.x_y"))).toEqual({ mime: "image/vnd.x_y", sha });
    expect(parseUploadedRef(ref("image/svg+xml;charset=utf-8"))?.sha).toBe(sha);
    expect(parseUploadedRef(ref("image/x:y"))).toEqual({ mime: "image/x:y", sha });
  });

  test("refuses anything that is not an uploaded reference", () => {
    expect(parseUploadedRef(`${SENTINEL_PREFIX}b:${sha}`)).toBeUndefined();
    expect(parseUploadedRef(`${SENTINEL_PREFIX}t:${sha}`)).toBeUndefined();
    expect(parseUploadedRef(ref("image/png").replace(sha, "b".repeat(63)))).toBeUndefined();
    expect(parseUploadedRef(`${SENTINEL_PREFIX}${ref("image/png")}`)).toBeUndefined();
    expect(parseUploadedRef("image/png")).toBeUndefined();
    expect(parseUploadedRef(ref("image/png").replace(`${SENTINEL_PREFIX}u:`, "u:"))).toBeUndefined();
  });
});
