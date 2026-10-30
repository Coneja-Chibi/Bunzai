/**
 * The ChatStore contract suite's Dramaturg half (specs/stage/chat-store.md rule 48): one record per scene holding the Dramaturg's settings and its conversation,
 * guarded by its revision. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError } from "../../studio/errors";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore, DramaturgEntryInput } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const ASK: DramaturgEntryInput = { role: "user", text: "Why did Vera lie about the ledger?" };
const ANSWER: DramaturgEntryInput = { role: "assistant", text: "Because #2 shows her protecting her sister.", reads: [{ tool: "read_scene_messages", summary: "read messages 1 to 2" }], model: "reader-model" };
const EMPTY = { settings: {}, entries: [], revision: 0 };
const settle = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

export function chatStoreDramaturgContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const turns = (n: number, from = 1): DramaturgEntryInput[] => Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", text: `turn ${from + i}` }));

  describe("the scene's Dramaturg (rule 48)", () => {
    test("a scene that has none answers the default; an absent scene answers null to every method", async () => {
      const { store, chat } = await seeded(1);
      expect(await store.getDramaturg(chat.id)).toEqual(EMPTY);
      expect(await store.getDramaturg("nope")).toBeNull();
      expect(await store.setDramaturgSettings("nope", { temperature: 1 })).toBeNull();
      expect(await store.appendDramaturg("nope", [ASK], { expectedRevision: 0 })).toBeNull();
      expect(await store.clearDramaturg("nope")).toBeNull();
    });

    test("settings: a key given replaces, null resets, a key left out stays, and the revision stays as it was", async () => {
      const { store, chat } = await seeded(1);
      const first = await store.setDramaturgSettings(chat.id, { model: { id: "conn", model: "reader" }, reasoning: "high", temperature: 0 });
      expect(first).toEqual({ settings: { model: { id: "conn", model: "reader" }, reasoning: "high", temperature: 0 }, entries: [], revision: 0 });
      expect((await store.setDramaturgSettings(chat.id, { temperature: 2 }))!.settings).toEqual({ model: { id: "conn", model: "reader" }, reasoning: "high", temperature: 2 });
      expect(await store.setDramaturgSettings(chat.id, { model: null })).toEqual({ settings: { reasoning: "high", temperature: 2 }, entries: [], revision: 0 });
      expect(await store.setDramaturgSettings(chat.id, { reasoning: null, temperature: null })).toEqual({ settings: {}, entries: [], revision: 0 });
      expect(await store.getDramaturg(chat.id)).toEqual({ settings: {}, entries: [], revision: 0 });
    });

    test("the revision guards the conversation only: an answer appended under the revision read before a settings change still lands", async () => {
      const { store, chat } = await seeded(1);
      const read = (await store.appendDramaturg(chat.id, [ASK], { expectedRevision: 0 }))!.revision;
      expect((await store.setDramaturgSettings(chat.id, { temperature: 0.2 }))!.revision).toBe(read);
      expect((await store.setDramaturgSettings(chat.id, { reasoning: "low" }))!.revision).toBe(read);
      const landed = (await store.appendDramaturg(chat.id, [ANSWER], { expectedRevision: read }))!;
      expect(landed.revision).toBe(read + 1);
      expect(landed.settings).toEqual({ temperature: 0.2, reasoning: "low" });
      expect(landed.entries.map((e) => e.text)).toEqual([ASK.text, ANSWER.text]);
    });

    test("a malformed settings patch is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setDramaturgSettings(chat.id, { temperature: 1 });
      const bad: unknown[] = [
        { temperature: 2.1 }, { temperature: -0.1 }, { temperature: Number.NaN }, { temperature: Number.POSITIVE_INFINITY }, { temperature: "1" },
        { reasoning: "extreme" }, { reasoning: 3 }, { model: { id: "", model: "m" } }, { model: { id: "c" } }, { model: "m" }, { model: { id: "c", model: "m", extra: 1 } },
        { enabled: true }, { personality: "the-oracle" }, { entries: [] }, { temperature: 0.5, reasoning: "extreme" }, [], "x", null, undefined,
      ];
      for (const patch of bad) expect(await settle(store.setDramaturgSettings(chat.id, patch as never))).toBeInstanceOf(StudioValidationError);
      expect(await store.getDramaturg(chat.id)).toEqual({ settings: { temperature: 1 }, entries: [], revision: 0 });
    });

    test("an append stamps each turn's id and time, keeps the conversation oldest first, and bumps the revision", async () => {
      const { store, chat, setNow } = await seeded(1);
      setNow(5_000);
      const one = (await store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 0 }))!;
      expect(one).toEqual({ settings: {}, revision: 1, entries: [{ ...ASK, id: expect.any(String), at: 5_000 }, { ...ANSWER, id: expect.any(String), at: 5_000 }] });
      setNow(6_000);
      const failed: DramaturgEntryInput = { role: "assistant", text: "Half an answ", failed: "the connection dropped" };
      const two = (await store.appendDramaturg(chat.id, [{ role: "user", text: "And then?" }, failed], { expectedRevision: 1 }))!;
      expect(two.revision).toBe(2);
      expect(two.entries.map((e) => [e.text, e.at])).toEqual([[ASK.text, 5_000], [ANSWER.text, 5_000], ["And then?", 6_000], [failed.text, 6_000]]);
      expect(two.entries[3]).toEqual({ ...failed, id: expect.any(String), at: 6_000 });
      expect(two.entries.slice(0, 2)).toEqual(one.entries);
      const ids = two.entries.map((e) => e.id);
      expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(4);
      expect(await store.getDramaturg(chat.id)).toEqual(two);
    });

    test("an append at a revision the record has left is a conflict and writes nothing, so an answer never lands in a conversation cleared meanwhile", async () => {
      const { store, chat } = await seeded(1);
      const one = (await store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 0 }))!;
      expect(await settle(store.appendDramaturg(chat.id, [ASK], { expectedRevision: 0 }))).toBeInstanceOf(StudioConflictError);
      expect(await store.getDramaturg(chat.id)).toEqual(one);
      await store.clearDramaturg(chat.id);
      expect(await settle(store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 1 }))).toBeInstanceOf(StudioConflictError);
      expect(await store.getDramaturg(chat.id)).toEqual({ settings: {}, entries: [], revision: 2 });
      for (const guard of [undefined, null, {}, { expectedRevision: -1 }, { expectedRevision: 1.5 }, { expectedRevision: "2" }, { expectedRevision: 2, extra: 1 }]) {
        expect(await settle(store.appendDramaturg(chat.id, [ASK], guard as never))).toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getDramaturg(chat.id))!.revision).toBe(2);
    });

    test("past 200 turns the oldest go", async () => {
      const { store, chat } = await seeded(1);
      await store.appendDramaturg(chat.id, turns(199), { expectedRevision: 0 });
      const full = (await store.appendDramaturg(chat.id, turns(3, 200), { expectedRevision: 1 }))!;
      expect(full.entries).toHaveLength(200);
      expect([full.entries[0]!.text, full.entries.at(-1)!.text]).toEqual(["turn 3", "turn 202"]);
      const once = (await store.appendDramaturg(chat.id, turns(200, 500), { expectedRevision: 2 }))!;
      expect([once.entries.length, once.entries[0]!.text, once.revision]).toEqual([200, "turn 500", 3]);
    });

    test("every entry limit holds: a malformed turn refuses the whole append and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      const ok: DramaturgEntryInput = { role: "assistant", text: "x" };
      const read = { tool: "read_scene_messages", summary: "read messages 1 to 2" };
      const bad: unknown[] = [
        { role: "system", text: "x" }, { role: "user" }, { text: "x" }, { role: "user", text: 5 }, { role: "user", text: "x".repeat(40_001) },
        { ...ok, id: "mine" }, { ...ok, at: 1 }, { ...ok, extra: 1 },
        { ...ok, reads: "no" }, { ...ok, reads: new Array(41).fill(read) }, { ...ok, reads: [null] }, { ...ok, reads: [{ ...read, tool: "" }] }, { ...ok, reads: [{ ...read, tool: "t".repeat(65) }] },
        { ...ok, reads: [{ ...read, summary: "s".repeat(301) }] }, { ...ok, reads: [{ tool: "t" }] }, { ...ok, reads: [{ ...read, extra: 1 }] }, { ...ok, reads: [{ ...read, summary: 3 }] },
        { ...ok, model: "m".repeat(201) }, { ...ok, model: "" }, { ...ok, model: 5 }, { ...ok, failed: "f".repeat(601) }, { ...ok, failed: "" }, { ...ok, failed: true },
        null, "x", [],
      ];
      for (const entry of bad) expect(await settle(store.appendDramaturg(chat.id, [ok, entry as never], { expectedRevision: 0 }))).toBeInstanceOf(StudioValidationError);
      for (const list of [[], "x", null, {}, turns(201)]) expect(await settle(store.appendDramaturg(chat.id, list as never, { expectedRevision: 0 }))).toBeInstanceOf(StudioValidationError);
      expect(await store.getDramaturg(chat.id)).toEqual(EMPTY);
      const longest: DramaturgEntryInput = { role: "assistant", text: "x".repeat(40_000), reads: new Array(40).fill({ tool: "t".repeat(64), summary: "s".repeat(300) }), model: "m".repeat(200), failed: "f".repeat(600) };
      const kept = (await store.appendDramaturg(chat.id, [{ role: "user", text: "" }, longest], { expectedRevision: 0 }))!;
      expect(kept.entries.map(({ id: _id, at: _at, ...rest }) => rest)).toEqual([{ role: "user", text: "" }, longest]);
    });

    test("clear empties the conversation and keeps the settings, under the guard when one is given", async () => {
      const { store, chat } = await seeded(1);
      await store.setDramaturgSettings(chat.id, { temperature: 0.3 });
      const one = (await store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 0 }))!;
      expect(await settle(store.clearDramaturg(chat.id, { expectedRevision: 0 }))).toBeInstanceOf(StudioConflictError);
      expect(await store.getDramaturg(chat.id)).toEqual(one);
      expect(await settle(store.clearDramaturg(chat.id, { expectedRevision: "1" } as never))).toBeInstanceOf(StudioValidationError);
      expect(await store.clearDramaturg(chat.id, { expectedRevision: 1 })).toEqual({ settings: { temperature: 0.3 }, entries: [], revision: 2 });
      expect(await store.clearDramaturg(chat.id)).toEqual({ settings: { temperature: 0.3 }, entries: [], revision: 3 });
      expect(await store.getDramaturg(chat.id)).toEqual({ settings: { temperature: 0.3 }, entries: [], revision: 3 });
    });

    test("no write moves the scene's version or its updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(2);
      const before = (await store.readMessages(main, { limit: 5 })).branchVersion;
      setNow(9_000);
      await store.setDramaturgSettings(chat.id, { reasoning: "low" });
      await store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 0 });
      await store.clearDramaturg(chat.id, { expectedRevision: 1 });
      expect((await store.readMessages(main, { limit: 5 })).branchVersion).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("it is per scene: a fork does not copy it and a take switch does not change it", async () => {
      const { store, chat, main, ids } = await seeded(2);
      const held = (await store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 0 }))!;
      const fork = (await store.fork(main, ids[1]!, { name: "Take 2" }))!;
      expect(await store.getDramaturg(chat.id)).toEqual(held);
      await store.setActiveBranch(chat.id, fork.id);
      expect(await store.getDramaturg(chat.id)).toEqual(held);
      const more = (await store.appendDramaturg(chat.id, [{ role: "user", text: "On this take?" }], { expectedRevision: 1 }))!;
      await store.setActiveBranch(chat.id, main);
      expect(await store.getDramaturg(chat.id)).toEqual(more);
      expect(more.entries).toHaveLength(3);
    });

    test("a deleted scene hides it and refuses its writes, a restore brings it back, and a purge removes it", async () => {
      const { store, chat, setNow } = await seeded(1);
      await store.setDramaturgSettings(chat.id, { temperature: 1.2 });
      const held = (await store.appendDramaturg(chat.id, [ASK, ANSWER], { expectedRevision: 0 }))!;
      setNow(2_000);
      await store.deleteChat(chat.id);
      expect(await store.getDramaturg(chat.id)).toBeNull();
      expect(await store.setDramaturgSettings(chat.id, { temperature: 0.1 })).toBeNull();
      expect(await store.appendDramaturg(chat.id, [ASK], { expectedRevision: 0 })).toBeNull();
      expect(await store.clearDramaturg(chat.id, { expectedRevision: 0 })).toBeNull();
      await store.restoreChat(chat.id);
      expect(await store.getDramaturg(chat.id)).toEqual(held);
      await store.deleteChat(chat.id);
      expect(await store.purgeChats(3_000)).toBe(1);
      expect(await store.getDramaturg(chat.id)).toBeNull();
      expect(await store.appendDramaturg(chat.id, [ASK], { expectedRevision: 1 })).toBeNull();
    });
  });
}
