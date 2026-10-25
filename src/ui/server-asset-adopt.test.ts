/** Copying a whole pack by grant: forty pictures in one go, spent only by the session that asked, only for pictures the library holds. */
import { expect, test } from "bun:test";
import { bytesToBase64 } from "../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { StudioStore } from "../studio/store";
import { adoptLibraryAssets } from "./server-asset-adopt";
import { openSessionUploads } from "./server-asset-staging";

const rig = () => { const content = createContentStore(memoryDocumentBackend()); return new StudioStore("memory", () => content); };
const picture = (seed: number): Uint8Array => new Uint8Array(20_000).map((_, i) => (i * 31 + seed) % 256);
const pack = (id: string, count: number) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id,
  body: { name: id, pack: { items: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, label: `scene ${i}`, ref: `data:image/png;base64,${bytesToBase64(picture(i))}` })) } },
});
const ask = (store: StudioStore, session: string, assets: unknown) =>
  adoptLibraryAssets(new Request("http://x/api/asset/adopt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assets }) }), session, store);
type Item = { id: string; label: string; ref: string };
type Light = { entity: { body: { pack: { items: Item[] } } }; revision: string };

test("forty pictures copy into another pack through grants, past the eight-upload limit", async () => {
  const store = rig();
  await store.save(pack("source", 40));
  await store.save(pack("target", 0));
  const source = (await store.readLight("pack", "source")) as unknown as Light;
  const refs = source.entity.body.pack.items.map((item) => item.ref);
  const res = await ask(store, "s1", refs);
  expect(res.status).toBe(200);
  const { grants } = (await res.json()) as { grants: { ref: string; asset: string }[] };
  expect(grants).toHaveLength(40);
  const uploads = await openSessionUploads(grants.map((g) => g.ref), "s1", store);
  expect(uploads).toHaveLength(40);
  const target = (await store.readLight("pack", "target")) as unknown as Light;
  const head = { ...target.entity, body: { ...target.entity.body, pack: { items: source.entity.body.pack.items } } };
  const saved = await store.comparePatch("pack", "target", target.revision, { head } as never, uploads);
  expect(saved.status).toBe("saved");
  const after = (await store.readLight("pack", "target")) as unknown as Light;
  expect(after.entity.body.pack.items.map((i) => i.ref)).toEqual(refs);
});

test("a grant is spent only by the session that asked, once, and never for a picture the library lacks", async () => {
  const store = rig();
  await store.save(pack("source", 1));
  const [item] = ((await store.readLight("pack", "source")) as unknown as Light).entity.body.pack.items;
  const { grants } = (await (await ask(store, "mine", [item!.ref])).json()) as { grants: { ref: string }[] };
  await expect(openSessionUploads([grants[0]!.ref], "someone else", store)).rejects.toThrow();
  expect(await openSessionUploads([grants[0]!.ref], "mine", store)).toHaveLength(1);
  expect((await ask(store, "mine", [`\u0000b:u:image/png:${"e".repeat(64)}`])).status).toBe(404);
  expect((await ask(store, "mine", ["data:image/png;base64,AAAA"])).status).toBe(400);
  expect((await ask(store, "", [item!.ref])).status).toBe(403);
});
