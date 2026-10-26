/** One load, one revision, one `accepted` base and one save queue per lorebook: two books saving at once never share any of them. */
import { describe, expect, test } from "bun:test";
import type { LorebookBody, LorebookEntry } from "../../../entities/lorebook/schema";
import type { PiecePatch } from "../../../stage/contracts/piece-patch";
import type { ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import { emptyLoreEntry } from "../../../core/lore";
import { ApiHttpError } from "../../_shared/api-fetch";
import { applyPiecePatch } from "../../_shared/editor-patch";
import { createLoreBookSessions, type LoreBookState } from "./lore-book-sessions";

const entry = (id: string, over: Partial<LorebookEntry> = {}): LorebookEntry => ({ ...emptyLoreEntry(id), title: id, content: `content-${id}`, sortOrder: 100, ...over });
const body = (name: string, entries: LorebookEntry[]): LorebookBody => ({
  name, tags: [], globalCaseSensitive: false, globalMatchWholeWords: false, globalScanDepth: 4, globalRecursion: true, tokenBudget: 2000, budgetMode: "token", entryBudget: 100, entries,
});
type Held = { entity: { kind: string; id: string; body: LorebookBody }; revision: number };

function rig() {
  const held = new Map<string, Held>([
    ["A", { entity: { kind: "lorebook", id: "A", body: body("Book A", [entry("a1"), entry("a2")]) }, revision: 1 }],
    ["B", { entity: { kind: "lorebook", id: "B", body: body("Book B", [entry("b1"), entry("b2")]) }, revision: 7 }],
  ]);
  const sent: { id: string; revision: string; patch: PiecePatch }[] = [];
  const gates = new Map<string, () => void>();
  const states = new Map<string, LoreBookState>();
  const errors: string[] = [];
  const stale: string[] = [];
  let saving = 0;
  const api = {
    getLightEditableEntity: async (query: string) => {
      const id = decodeURIComponent(/id=([^&]+)/.exec(query)![1]!);
      const h = held.get(id)!;
      return { entity: structuredClone(h.entity), revision: `r${h.revision}`, version: 1 };
    },
    patchEditedEntity: async (_kind: string, id: string, revision: string, patch: PiecePatch) => {
      await new Promise<void>((release) => { gates.set(id, release); if (!hold.has(id)) release(); });
      const h = held.get(id)!;
      if (revision !== `r${h.revision}`) throw new ApiHttpError(409, "conflict");
      sent.push({ id, revision, patch });
      h.entity = applyPiecePatch(h.entity as unknown as ParsedCanonicalEntity, patch) as unknown as Held["entity"];
      h.revision += 1;
      return { revision: `r${h.revision}` };
    },
  };
  const hold = new Set<string>();
  const sessions = createLoreBookSessions({
    api: () => api as unknown as ReturnType<Parameters<typeof createLoreBookSessions>[0]["api"]>, alive: () => true, onState: (id, s) => { states.set(id, s); }, onSaving: (d) => { saving += d; }, onStale: (id) => { stale.push(id); }, onError: (id, m) => { errors.push(`${id}: ${m}`); },
  });
  return { held, sent, gates, hold, states, errors, stale, sessions, saving: () => saving };
}
const retitle = (id: string, title: string) => (entries: LorebookEntry[]): LorebookEntry[] => entries.map((e) => (e.id === id ? { ...e, title } : e));

describe("per-book isolation", () => {
  test("two books edited and saved at once each save against their own revision and base, and neither overwrites the other", async () => {
    const r = rig();
    const a = r.sessions.ensure("A"), b = r.sessions.ensure("B");
    await Promise.all([a.load(), b.load()]);
    r.hold.add("A"); r.hold.add("B");
    expect(a.apply(retitle("a1", "A one edited"))).toBe(true);
    expect(b.apply(retitle("b2", "B two edited"))).toBe(true);
    a.save(a.generation(), "manual");
    b.save(b.generation(), "manual");
    // B's save is released first while A's is still in flight: a shared queue would be stuck behind A.
    await new Promise((x) => setTimeout(x, 5));
    r.hold.delete("B"); r.gates.get("B")?.();
    await b.idle();
    expect(r.sent.map((s) => s.id)).toEqual(["B"]);
    r.hold.delete("A"); r.gates.get("A")?.();
    await a.idle();
    expect(r.sent.map((s) => [s.id, s.revision])).toEqual([["B", "r7"], ["A", "r1"]]);
    expect(r.held.get("A")!.entity.body.entries.map((e) => e.title)).toEqual(["A one edited", "a2"]);
    expect(r.held.get("B")!.entity.body.entries.map((e) => e.title)).toEqual(["b1", "B two edited"]);
    expect(r.errors).toEqual([]);
    expect(r.saving()).toBe(0);
  });

  test("each book's patch carries only its own changed entry, measured against its own accepted base", async () => {
    const r = rig();
    const a = r.sessions.ensure("A"), b = r.sessions.ensure("B");
    await Promise.all([a.load(), b.load()]);
    a.apply(retitle("a1", "A1"));
    b.apply(retitle("b1", "B1"));
    a.save(a.generation(), "autosave");
    b.save(b.generation(), "autosave");
    await Promise.all([a.idle(), b.idle()]);
    expect(r.sent.map((s) => Object.keys(s.patch.items ?? {}))).toEqual([["i/a1"], ["i/b1"]]);
    // a second edit to A measures against what A's library accepted, not against B's save
    a.apply(retitle("a2", "A2"));
    a.save(a.generation(), "autosave");
    await a.idle();
    expect(r.sent.at(-1)!.revision).toBe("r2");
    expect(Object.keys(r.sent.at(-1)!.patch.items ?? {})).toEqual(["i/a2"]);
  });

  test("one book's 409 reloads that book only and leaves the other's edit and revision alone", async () => {
    const r = rig();
    const a = r.sessions.ensure("A"), b = r.sessions.ensure("B");
    await Promise.all([a.load(), b.load()]);
    r.held.get("A")!.revision += 1; // A changed somewhere else
    a.apply(retitle("a1", "lost to the 409"));
    b.apply(retitle("b1", "B survives"));
    a.save(a.generation(), "manual");
    b.save(b.generation(), "manual");
    await Promise.all([a.idle(), b.idle()]);
    expect(r.stale).toEqual(["A"]);
    expect(r.held.get("B")!.entity.body.entries[0]!.title).toBe("B survives");
    expect(a.state().state === "ready" && a.state()).toMatchObject({ revision: "r2" });
    expect(r.held.get("A")!.entity.body.entries[0]!.title).toBe("a1");
  });

  test("a save queued for a load the session has since replaced is dropped", async () => {
    const r = rig();
    const a = r.sessions.ensure("A");
    await a.load();
    a.apply(retitle("a1", "typed"));
    const gen = a.generation();
    await a.load();
    a.save(gen, "autosave");
    await a.idle();
    expect(r.sent).toEqual([]);
  });

  test("dropping a book waits for its save, then forgets it", async () => {
    const r = rig();
    const a = r.sessions.ensure("A");
    await a.load();
    r.hold.add("A");
    a.apply(retitle("a1", "kept"));
    a.save(a.generation(), "manual");
    r.sessions.drop("A");
    expect(r.sessions.ids()).toEqual(["A"]);
    await new Promise((x) => setTimeout(x, 5));
    r.hold.delete("A"); r.gates.get("A")?.();
    await r.sessions.idle();
    expect(r.sent).toHaveLength(1);
    expect(r.sessions.ids()).toEqual([]);
  });
});
