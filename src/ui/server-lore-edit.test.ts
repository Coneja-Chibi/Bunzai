/**
 * The World wing's save path through the real routes and the real encrypted store: a 213-entry book
 * with escrow is read with `GET /api/studio/get?light=1` (no escrow on the wire), one entry is edited
 * with the exact patch the wing builds (`buildPiecePatch`), and `POST /api/studio/patch` writes it.
 * Only that entry changes, the escrow and every other entry are as they were, a stale revision is a
 * 409, and the activation engine reads the saved keyword. The wing's own tests run the same saves
 * against a fake library (scene-lore-entries.test.tsx); this is the proof against the real one.
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore/empty-book";
import { runLore } from "../core/lore/engine";
import { countText } from "../core/tokens";
import type { LorebookBody } from "../entities/lorebook/schema";
import { parseCanonicalEntity } from "../entities/runtime-schema";
import { buildPiecePatch } from "./_shared/editor-patch";
import { chatRouteRig as rig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);
setDefaultTimeout(30_000);

const ESCROW = { sidecar: { raw: { big: "escrow payload ".repeat(2_000) } } };
const bigBook = () => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "big",
  body: {
    ...emptyLorebookBody("Between Two Earths"),
    entries: Array.from({ length: 213 }, (_, i) => ({ ...emptyLoreEntry(`e${i}`), title: `Entry ${i}`, content: `content ${i}`, triggers: [{ keyword: `key${i}`, isRegex: false }], sortOrder: i })),
  },
  original: ESCROW,
});

test("a typed edit saves as a one-entry patch against the light read, and nothing else in the book moves", async () => {
  const { store, handler, post } = await rig();
  await store.save(bigBook());
  const escrowBefore = ((await store.read("lorebook", "big")) as unknown as { original: unknown }).original;

  const lightRes = await handler(apiReq("/api/studio/get?kind=lorebook&id=big&light=1"));
  expect(lightRes.status).toBe(200);
  const light = (await lightRes.json()) as { entity: Record<string, unknown> & { body: LorebookBody }; revision: string };
  expect(light.entity.body.entries).toHaveLength(213);
  expect(JSON.stringify(light.entity)).not.toContain("escrow payload"); // the escrow never crossed the wire

  const base = parseCanonicalEntity(light.entity);
  const edited = structuredClone(light.entity) as typeof light.entity;
  edited.body.entries[7] = { ...edited.body.entries[7]!, title: "Entry 7, renamed", triggers: [{ keyword: "gale", isRegex: false }] };
  const patch = buildPiecePatch(base, parseCanonicalEntity(edited));
  expect(Object.keys(patch.items ?? {})).toEqual(["i/e7"]);
  expect(patch.order).toBeUndefined();

  const saved = await post("/api/studio/patch", { kind: "lorebook", id: "big", expectedRevision: light.revision, intent: "autosave", ...patch });
  expect(saved.status).toBe(200);
  const { revision } = (await saved.json()) as { revision: string };
  expect(revision).not.toBe(light.revision);

  const after = (await store.read("lorebook", "big")) as unknown as { body: LorebookBody; original: unknown };
  expect(after.body.entries[7]).toMatchObject({ title: "Entry 7, renamed", triggers: [{ keyword: "gale", isRegex: false }] });
  const before = bigBook().body.entries;
  expect(after.body.entries.filter((_, i) => i !== 7)).toEqual(before.filter((_, i) => i !== 7));
  expect(after.original).toEqual(escrowBefore); // the escrow the library holds is untouched
  expect((after.original as typeof ESCROW).sidecar).toEqual(ESCROW.sidecar);

  // the next turn reads the saved keyword
  const fired = (said: string) => runLore([{ id: "big", name: "big", body: after.body }], {
    messages: [{ role: "user", content: said }], messageCount: 1, character: { name: "Aria", tags: [], description: "", personality: "", scenario: "" },
    persona: "", generationType: "normal", variables: {}, now: 1_700_000_000_000,
  }, { rng: () => 0, countTokens: countText, budgetTokens: Infinity, recentFires: [] }).injected.map((h) => h.entryId);
  expect(fired("a gale rolls in")).toEqual(["e7"]);
  expect(fired("key7")).toEqual([]);

  // a second save built on the revision this one replaced is refused, and writes nothing
  const stale = await post("/api/studio/patch", { kind: "lorebook", id: "big", expectedRevision: light.revision, intent: "autosave", ...patch });
  expect(stale.status).toBe(409);
});

test("Move: the swapped pair is one patch, and the order the library keeps is the new sortOrder", async () => {
  const { store, handler, post } = await rig();
  await store.save(bigBook());
  const light = (await (await handler(apiReq("/api/studio/get?kind=lorebook&id=big&light=1"))).json()) as { entity: { body: LorebookBody }; revision: string };
  const next = structuredClone(light.entity);
  const [a, b] = [next.body.entries[3]!, next.body.entries[4]!];
  [a.sortOrder, b.sortOrder] = [b.sortOrder, a.sortOrder];
  const patch = buildPiecePatch(parseCanonicalEntity(light.entity), parseCanonicalEntity(next));
  expect(Object.keys(patch.items ?? {}).sort()).toEqual(["i/e3", "i/e4"]);
  expect((await post("/api/studio/patch", { kind: "lorebook", id: "big", expectedRevision: light.revision, intent: "manual", ...patch })).status).toBe(200);
  const after = (await store.read("lorebook", "big")) as unknown as { body: LorebookBody };
  expect([after.body.entries[3]!.sortOrder, after.body.entries[4]!.sortOrder]).toEqual([4, 3]);
});

test("the library listing the picker reads already carries each book's entry count", async () => {
  const { store, handler } = await rig();
  await store.save(bigBook());
  const list = (await (await handler(apiReq("/api/studio/list?kind=lorebook"))).json()) as { id: string; name: string; facts?: { lore?: { entryCount: number } } }[];
  expect(list.map((s) => [s.id, s.facts?.lore?.entryCount])).toEqual([["big", 213]]);
});
