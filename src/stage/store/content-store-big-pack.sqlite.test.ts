/**
 * A big Sprite pack stays editable: a patch (rename, reorder, Add image) keeps every untouched
 * picture a reference to its blob, so a save costs the pack's head, never its pictures. Generated
 * bytes only; no machine-specific files. The pack is deliberately over the 8 MiB in-process cold
 * read cap (and far over what a 256 MiB worker charge tolerates once every picture is base64
 * twice), so these fail while a patch still expands every picture into a data URI.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { bytesToBase64 } from "../../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { hashHex } from "../../core/sha256";
import { StudioValidationError } from "../../studio/errors";
import { setGate } from "../caches";
import type { PartBlob } from "../contracts/content-store";
import { createContentStore } from "./content-store";
import { clearPieceCache, pieceCacheBytes } from "./piece-cache";
import type { StageDatabase } from "./sqlite/database";
import { memoryDocumentBackend } from "./memory/document-backend";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
beforeEach(() => { setGate(() => true); clearPieceCache(); });
afterEach(() => { for (const d of open.splice(0)) d.close(); setGate(() => true); clearPieceCache(); });

const IMAGES = 12;
const IMAGE_BYTES = 900 * 1024;
/** Deterministic, incompressible-looking bytes that differ per seed. */
const picture = (seed: number): Uint8Array => {
  const bytes = new Uint8Array(IMAGE_BYTES);
  let x = (seed + 1) * 2654435761;
  for (let i = 0; i < bytes.length; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; bytes[i] = x >>> 24; }
  return bytes;
};
const dataUri = (bytes: Uint8Array): string => `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
const packEntity = (name = "Backdrops") => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "pack",
  id: "bg",
  body: { name, pack: { items: Array.from({ length: IMAGES }, (_, i) => ({ id: `sp_${i}`, label: `scene ${i}`, ref: dataUri(picture(i)) })) } },
});
const blobCount = (d: StageDatabase): number => (d.db.query("SELECT count(*) AS n FROM blobs").get() as { n: number }).n;

const rig = () => {
  const d = freshDatabase(open);
  const store = createContentStore(sqliteDocumentBackend(d, testCipher()));
  return { d, store };
};
type Item = { id: string; label: string; ref: string };
type PackLight = { entity: { body: { name: string; pack: { items: Item[] } } }; revision: string };
const light = async (store: ReturnType<typeof rig>["store"]): Promise<PackLight> => (await store.readLight("pack", "bg")) as unknown as PackLight;
/** The sha each picture's reference names, read through the editor wire (never a full read of the pack). */
const shas = async (store: ReturnType<typeof rig>["store"]): Promise<string[]> =>
  (await light(store)).entity.body.pack.items.map((i) => i.ref.slice(i.ref.lastIndexOf(":") + 1));

test("renaming a pack larger than the in-process read cap saves, seals nothing, and keeps the pictures byte-exact", async () => {
  const { d, store } = rig();
  await store.save(packEntity());
  const before = await shas(store);
  const blobs = blobCount(d);
  clearPieceCache();
  const l = await light(store);
  const head = { ...l.entity, body: { ...l.entity.body, name: "Renamed" } };
  const result = await store.patch("pack", "bg", l.revision, { head });
  expect(result.status).toBe("saved");
  expect(blobCount(d)).toBe(blobs);
  expect(pieceCacheBytes()).toBeLessThan(2 * 1024 * 1024);
  expect(await shas(store)).toEqual(before);
  expect((await light(store)).entity.body.name).toBe("Renamed");
  const first = await store.readAsset(before[0]!, IMAGE_BYTES * 2);
  expect(first.status).toBe("ok");
  if (first.status === "ok") expect(hashHex(first.bytes)).toBe(before[0]!);
});

test("reordering a big pack keeps every picture and writes no new blob", async () => {
  const { d, store } = rig();
  await store.save(packEntity());
  const before = await shas(store);
  const blobs = blobCount(d);
  clearPieceCache();
  const l = await light(store);
  const items = [...l.entity.body.pack.items].reverse();
  const head = { ...l.entity, body: { ...l.entity.body, pack: { ...l.entity.body.pack, items } } };
  expect((await store.patch("pack", "bg", l.revision, { head })).status).toBe("saved");
  expect(blobCount(d)).toBe(blobs);
  expect(await shas(store)).toEqual([...before].reverse());
});

test("adding one picture to a big pack seals exactly one new blob and leaves the rest alone", async () => {
  const { d, store } = rig();
  await store.save(packEntity());
  const before = await shas(store);
  const blobs = blobCount(d);
  clearPieceCache();
  const added = picture(99);
  const sha = hashHex(added);
  const upload: PartBlob = { key: sha, payload: { kind: "bytes", bytes: added } };
  const l = await light(store);
  const items = [...l.entity.body.pack.items, { id: "sp_new", label: "new scene", ref: `\u0000b:u:image/jpeg:${sha}` }];
  const head = { ...l.entity, body: { ...l.entity.body, pack: { ...l.entity.body.pack, items } } };
  expect((await store.patch("pack", "bg", l.revision, { head }, [upload])).status).toBe("saved");
  expect(blobCount(d)).toBe(blobs + 1);
  expect(await shas(store)).toEqual([...before, sha]);
});

test("a patch naming a blob this piece does not hold is refused and writes nothing", async () => {
  const { d, store } = rig();
  await store.save(packEntity());
  const stranger = "e".repeat(64);
  clearPieceCache();
  const l = await light(store);
  const items = [...l.entity.body.pack.items, { id: "sp_x", label: "x", ref: `\u0000b:u:image/jpeg:${stranger}` }];
  const head = { ...l.entity, body: { ...l.entity.body, pack: { ...l.entity.body.pack, items } } };
  const rowBefore = d.db.query("SELECT write_id FROM documents").get();
  await expect(store.patch("pack", "bg", l.revision, { head })).rejects.toBeInstanceOf(StudioValidationError);
  expect(d.db.query("SELECT write_id FROM documents").get()).toEqual(rowBefore as never);
});

test("duplicating a big pack copies it by reference: same pictures, no new blob, the source untouched", async () => {
  const { d, store } = rig();
  await store.save(packEntity());
  const before = await shas(store);
  const blobs = blobCount(d);
  clearPieceCache();
  const copy = await store.duplicate("pack", "bg", (entity) => ({ ...entity, body: { ...(entity.body as object), name: "Backdrops copy" } }) as typeof entity);
  expect(copy).toMatchObject({ id: "bg-2", kind: "pack", name: "Backdrops copy" });
  expect(blobCount(d)).toBe(blobs);
  const light2 = (await store.readLight("pack", "bg-2")) as unknown as PackLight;
  expect(light2.entity.body.pack.items.map((i) => i.ref.slice(i.ref.lastIndexOf(":") + 1))).toEqual(before);
  expect(await shas(store)).toEqual(before);
  expect((await light(store)).entity.body.name).toBe("Backdrops");
  // a second copy takes the next free id, and deleting the original leaves the copy's pictures readable
  expect((await store.duplicate("pack", "bg"))?.id).toBe("bg-3");
  await store.delete("pack", "bg");
  const asset = await store.readAsset(before[0]!, IMAGE_BYTES * 2);
  expect(asset.status).toBe("ok");
  expect(await store.duplicate("pack", "nope")).toBeNull();
});

test("a coalesced autosave that keeps a picture only its replaced row held never loses the picture", async () => {
  const { store } = rig();
  await store.save(packEntity());
  const added = picture(77);
  const sha = hashHex(added);
  const upload: PartBlob = { key: sha, payload: { kind: "bytes", bytes: added } };
  clearPieceCache();
  let l = await light(store);
  const grown = { ...l.entity, body: { ...l.entity.body, pack: { items: [...l.entity.body.pack.items, { id: "sp_new", label: "new", ref: `\u0000b:u:image/jpeg:${sha}` }] } } };
  expect((await store.patch("pack", "bg", l.revision, { head: grown }, [upload], "autosave")).status).toBe("saved");
  l = await light(store);
  // same autosave window: the second save replaces the first save's own part row, the only holder of the new picture
  const renamed = { ...l.entity, body: { ...l.entity.body, name: "Renamed in the same window" } };
  expect((await store.patch("pack", "bg", l.revision, { head: renamed }, [], "autosave")).status).toBe("saved");
  const read = await store.readAsset(sha, IMAGE_BYTES * 2);
  expect(read.status).toBe("ok");
  if (read.status === "ok") expect(hashHex(read.bytes)).toBe(sha);
  expect((await shas(store)).at(-1)).toBe(sha);
});

test("a write that points at a blob nothing holds is refused whole, on either backend", async () => {
  const stranger = "d".repeat(64);
  const part = { name: "h", text: "{}", blobs: [], refs: [stranger] };
  const row = { kind: "pack", id: "x", revision: "r", version: 1, writeId: 1, autosaveStartedAt: null, createdAt: 1, updatedAt: 1 };
  const version = { kind: "pack", id: "x", version: 1, revision: "r", savedAt: 1, reason: "create" as const, autosaveStartedAt: null };
  for (const backend of [sqliteDocumentBackend(freshDatabase(open), testCipher()), memoryDocumentBackend()]) {
    await expect(backend.write(row, version, { when: "absent" }, { text: "s", derivedVersion: "1" }, { put: [part], drop: [] })).rejects.toThrow();
    expect(await backend.get("pack", "x")).toBeNull();
  }
});
