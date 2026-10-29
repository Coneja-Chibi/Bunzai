/**
 * The real library door (encrypted SQLite, the cold-read worker): an 18 MB Sprite pack of 20 pictures
 * is renamed, reordered and given one more picture without the worker ever opening a picture. Generated
 * bytes, a throwaway folder and a fake computer vault, never a real studio.
 */
import { afterEach, expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bytesToBase64 } from "../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { hashHex } from "../core/sha256";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { StudioStore } from "../studio/store";
import { removeTempDir } from "../studio/test-temp-dir";
import { openLibrary, type OpenedLibrary } from "./library-root";
import { openPackZip } from "./_shared/pack-export";
import { streamOf } from "./_shared/byte-stream";
import { libraryContentFor } from "../studio/library-content";

const opened: OpenedLibrary[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const l of opened.splice(0)) l.close();
  await Promise.all(dirs.splice(0).map(removeTempDir));
});

const IMAGES = 20;
const IMAGE_BYTES = 900 * 1024;
const picture = (seed: number): Uint8Array => {
  const bytes = new Uint8Array(IMAGE_BYTES);
  let x = (seed + 1) * 2654435761;
  for (let i = 0; i < bytes.length; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; bytes[i] = x >>> 24; }
  return bytes;
};
type Item = { id: string; label: string; ref: string };
type Light = { entity: { body: { name: string; pack: { items: Item[] } } }; revision: string };

test("an 18 MB pack saves a rename, a reorder and an added picture, then duplicates and prints, through the cold-read worker", async () => {
  const root = mkdtempSync(join(tmpdir(), "bunzai-big-pack-"));
  dirs.push(root);
  const dir = join(root, "Bunzai Studio");
  const library = await openLibrary(dir, { vault: fakeComputer(), skipOpenMaintenance: true, sessionsDir: join(root, "sessions") });
  opened.push(library);
  const store = new StudioStore(dir);
  const items = Array.from({ length: IMAGES }, (_, i) => ({ id: `sp_${i}`, label: `scene ${i}`, ref: `data:image/jpeg;base64,${bytesToBase64(picture(i))}` }));
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "bg", body: { name: "Backdrops", pack: { items } } } as never);
  const light = async (): Promise<Light> => (await store.readLight("pack", "bg")) as unknown as Light;

  let l = await light();
  const renamed = await store.comparePatch("pack", "bg", l.revision, { head: { ...l.entity, body: { ...l.entity.body, name: "Renamed" } } });
  expect(renamed.status).toBe("saved");

  l = await light();
  const reversed = [...l.entity.body.pack.items].reverse();
  const reordered = await store.comparePatch("pack", "bg", l.revision, { head: { ...l.entity, body: { ...l.entity.body, pack: { ...l.entity.body.pack, items: reversed } } } });
  expect(reordered.status).toBe("saved");

  l = await light();
  const added = picture(99);
  const sha = hashHex(added);
  const grown = [...l.entity.body.pack.items, { id: "sp_new", label: "new scene", ref: `\u0000b:u:image/jpeg:${sha}` }];
  const result = await store.comparePatch("pack", "bg", l.revision, { head: { ...l.entity, body: { ...l.entity.body, pack: { ...l.entity.body.pack, items: grown } } } }, [{ key: sha, payload: { kind: "bytes", bytes: added } }]);
  expect(result.status).toBe("saved");

  const copy = await store.duplicate("pack", "bg");
  expect(copy).toMatchObject({ id: "bg-2", kind: "pack" });
  const printed = unzipSync(new Uint8Array(await new Response(streamOf(await openPackZip(store, "bg-2"))).arrayBuffer()));
  expect(Object.keys(printed)).toHaveLength(IMAGES + 1);
  expect(Object.values(printed).map((file) => hashHex(file))).toContain(sha);

  l = await light();
  expect(l.entity.body.name).toBe("Renamed");
  expect(l.entity.body.pack.items.map((i) => i.label)).toEqual([...Array.from({ length: IMAGES }, (_, i) => `scene ${IMAGES - 1 - i}`), "new scene"]);
}, 120_000);

test("a whole read of the 18 MB pack succeeds through the worker, and restoring an older version never opens it whole", async () => {
  const root = mkdtempSync(join(tmpdir(), "bunzai-big-pack-read-"));
  dirs.push(root);
  const dir = join(root, "Bunzai Studio");
  const library = await openLibrary(dir, { vault: fakeComputer(), skipOpenMaintenance: true, sessionsDir: join(root, "sessions") });
  opened.push(library);
  const store = new StudioStore(dir);
  const items = Array.from({ length: IMAGES }, (_, i) => ({ id: `sp_${i}`, label: `scene ${i}`, ref: `data:image/jpeg;base64,${bytesToBase64(picture(i))}` }));
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "bg", body: { name: "Backdrops", pack: { items } } } as never);
  const whole = await store.read("pack", "bg");
  expect((whole!.body as unknown as { pack: { items: Item[] } }).pack.items[0]!.ref).toBe(items[0]!.ref);
  const l = (await store.readLight("pack", "bg")) as unknown as Light;
  await store.comparePatch("pack", "bg", l.revision, { head: { ...l.entity, body: { ...l.entity.body, name: "Renamed" } } });
  const content = libraryContentFor(dir)!;
  const restored = await content.restoreVersion("pack", "bg", 1);
  expect(restored).toMatchObject({ kind: "pack", version: 3 });
  expect(((await store.readLight("pack", "bg")) as unknown as Light).entity.body.name).toBe("Backdrops");
}, 120_000);
