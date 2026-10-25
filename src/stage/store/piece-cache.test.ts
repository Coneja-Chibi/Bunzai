/**
 * The patch path's write-side cache: deep freeze (an
 * in-place mutation must be impossible, since `decompose`'s `reuse` trusts reference identity), LRU
 * eviction, and the registry's own three hooks (bytes/trim/clear).
 */
import { beforeEach, expect, test } from "bun:test";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import {
  clearPieceCache,
  getCachedPiece,
  newPieceCacheToken,
  pieceCacheBytes,
  setCachedPiece,
  setPieceCacheGate,
  trimPieceCache,
  __pieceCacheSizeForTests,
} from "./piece-cache";

// The gate (`setPieceCacheGate`) is one shared module-level closure, registered process-wide by
// whichever test file runs last through `src/stage/caches.ts`'s `setGate` - a keyring test elsewhere in
// this same bun process can leave it closed (locked) long after that file's own tests finished
// (`keyring-token-cache.test.ts`'s own comment names the exact same trap for the token cache's gate).
// Reopened before every test here, since this file's own tests know nothing about locking and must not
// depend on which other files ran first.
beforeEach(() => {
  clearPieceCache();
  setPieceCacheGate(() => true);
});

const entity = (name: string) =>
  parseCanonicalEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "vera",
    body: { identity: { name }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
  });

const part = (name: string, json: string, value: unknown) => ({ name, json, hash: "h", blobs: [], value });

test("a cached entity is frozen: an in-place mutation throws in strict mode", () => {
  const token = newPieceCacheToken();
  const e = entity("Vera");
  setCachedPiece(token, "character", "vera", { version: 1, writeId: 1, revision: "r1", entity: e, parts: [] });
  const cached = getCachedPiece(token, "character", "vera")!;
  const body = cached.entity.body as unknown as { identity: { name: string } };
  expect(() => {
    body.identity.name = "Mutated";
  }).toThrow(TypeError);
  expect(body.identity.name).toBe("Vera");
});

test("a cached part's own value is frozen too, recursively", () => {
  const token = newPieceCacheToken();
  const value = { nested: { count: 1 } };
  setCachedPiece(token, "character", "vera", { version: 1, writeId: 1, revision: "r1", entity: entity("Vera"), parts: [part("i/x", "{}", value)] });
  const cached = getCachedPiece(token, "character", "vera")!;
  const got = cached.parts[0]!.value as { nested: { count: number } };
  expect(() => {
    got.nested.count = 2;
  }).toThrow(TypeError);
  expect(got.nested.count).toBe(1);
});

test("a cached part's own record (hash, json, blobs) is frozen too, not only its value: buildPart (piece-parts.ts) hands this exact object back on the next decompose when the value is unchanged, so the record itself must be immutable or a future revision could agree with content it never re-hashed", () => {
  const token = newPieceCacheToken();
  setCachedPiece(token, "character", "vera", { version: 1, writeId: 1, revision: "r1", entity: entity("Vera"), parts: [part("i/x", "{}", {})] });
  const cached = getCachedPiece(token, "character", "vera")!;
  const got = cached.parts[0]!;
  expect(() => {
    (got as { hash: string }).hash = "poisoned";
  }).toThrow(TypeError);
  expect(got.hash).toBe("h");
});

test("a typed array inside a cached value is never frozen (Object.freeze throws on one), but mutating it is still not this cache's problem to solve", () => {
  const token = newPieceCacheToken();
  const bytes = new Uint8Array([1, 2, 3]);
  // The point of this test is narrower than the name above suggests: deepFreeze must not THROW when
  // it encounters a typed array (Object.freeze does, on a non-empty one), not that the bytes end up
  // immutable - they never travel inside a cached entity or item value in practice (blob payloads live
  // in the backend's own blobs table since S4b, never in a PartRecord's `value`).
  expect(() => setCachedPiece(token, "character", "vera", { version: 1, writeId: 1, revision: "r1", entity: entity("Vera"), parts: [part("i/x", "{}", bytes)] })).not.toThrow();
});

test("two stores never see each other's entry, even for the same kind and id", () => {
  const tokenA = newPieceCacheToken();
  const tokenB = newPieceCacheToken();
  setCachedPiece(tokenA, "character", "vera", { version: 1, writeId: 1, revision: "rA", entity: entity("A"), parts: [] });
  setCachedPiece(tokenB, "character", "vera", { version: 1, writeId: 1, revision: "rB", entity: entity("B"), parts: [] });
  expect(getCachedPiece(tokenA, "character", "vera")?.revision).toBe("rA");
  expect(getCachedPiece(tokenB, "character", "vera")?.revision).toBe("rB");
});

test("at most 4 entries: the least recently used one is evicted first", () => {
  const token = newPieceCacheToken();
  for (let i = 0; i < 4; i++) setCachedPiece(token, "character", `c${i}`, { version: 1, writeId: 1, revision: `r${i}`, entity: entity(`${i}`), parts: [] });
  expect(__pieceCacheSizeForTests()).toBe(4);
  getCachedPiece(token, "character", "c0"); // touch c0 to the front, so c1 is now the LRU
  setCachedPiece(token, "character", "c4", { version: 1, writeId: 1, revision: "r4", entity: entity("4"), parts: [] });
  expect(__pieceCacheSizeForTests()).toBe(4);
  expect(getCachedPiece(token, "character", "c1")).toBeUndefined(); // evicted
  expect(getCachedPiece(token, "character", "c0")).toBeDefined(); // spared by the touch
});

test("entryBytes counts a part's blobs, not only its (sentinel-length) json: an escrow blob's real size is retained memory", () => {
  const token = newPieceCacheToken();
  // A part's own `json` holds only the short sentinel ("\u0000b:t:<sha>"), never the blob's decoded
  // bytes (`piece-parts-blob.ts`'s own split) - the blob payload is what this cache actually retains in
  // `value`-adjacent memory once a read or a cold fill resolves it. An estimate that sums only `json`
  // would report a 40 KB escrow blob as a few dozen bytes.
  const blobBytes = new Uint8Array(40_000);
  const part = { name: "r/testfmt", json: '21:{"big":"\\u0000b:b:abc"}', hash: "h", blobs: [{ key: "abc", payload: { kind: "bytes" as const, bytes: blobBytes } }], value: { big: blobBytes } };
  setCachedPiece(token, "preset", "p1", { version: 1, writeId: 1, revision: "r1", entity: entity("p1"), parts: [part] });
  expect(pieceCacheBytes()).toBeGreaterThanOrEqual(40_000);
});

test("trimPieceCache evicts down to at most the target bytes, and clearPieceCache empties it", () => {
  const token = newPieceCacheToken();
  const bigJson = "x".repeat(10_000);
  setCachedPiece(token, "character", "a", { version: 1, writeId: 1, revision: "r", entity: entity("a"), parts: [part("i/x", bigJson, {})] });
  setCachedPiece(token, "character", "b", { version: 1, writeId: 1, revision: "r", entity: entity("b"), parts: [part("i/x", bigJson, {})] });
  expect(pieceCacheBytes()).toBeGreaterThan(0);
  trimPieceCache(0);
  expect(__pieceCacheSizeForTests()).toBeLessThanOrEqual(1); // "never below 1 entry" is evictOverflow's own floor
  clearPieceCache();
  expect(__pieceCacheSizeForTests()).toBe(0);
  expect(pieceCacheBytes()).toBe(0);
});
