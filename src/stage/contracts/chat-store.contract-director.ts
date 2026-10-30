/**
 * The ChatStore contract suite's Story Director half: the scene's Director settings, and one story-state snapshot per version of a reply.
 * chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore, DirectorState } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export const blankDirector = (note = ""): DirectorState => ({
  chapters: [], arcs: [], seeds: [], invisibleArcs: [], notes: note ? [{ id: "n1", content: note, createdAt: 1 }] : [],
  pacing: { currentMood: "calm", turnsAtCurrentMood: 0, recentMoodHistory: [], rhythm: { lastActionSequence: 0, lastQuietMoment: 0, lastEmotionalBeat: 0 }, chapterPhase: "development", recommendations: { needsQuietMoment: false, needsTension: false, readyForClimax: false, needsBreather: false } },
  recentAnalysis: [], nextIntentions: [], suggestedActions: [], activity: [], nextId: 1,
});

export function chatStoreDirectorContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  /** Two more messages on the take (a user line and a reply), their ids. */
  const more = async (store: ChatStore, main: string) => [(await store.appendMessage(main, { role: "user", content: "more" }))!.id, (await store.appendMessage(main, { role: "assistant", content: "reply" }))!.id];
  const noteOf = (s: { state: DirectorState } | null) => s?.state.notes[0]?.content ?? null;

  describe("the scene's Director settings (rule 47)", () => {
    test("a new chat has none; a patch keeps what it gives, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main } = await seeded(1);
      expect(chat.director).toBeUndefined();
      const before = (await store.readMessages(main, { limit: 1 })).branchVersion;
      const set = await store.setDirectorSettings(chat.id, { personality: "the-oracle", temperature: 0.5, model: { id: "conn", model: "m" }, autoRetry: false, instructions: "Keep it warm." });
      expect(set!.director).toEqual({ personality: "the-oracle", temperature: 0.5, model: { id: "conn", model: "m" }, autoRetry: false, instructions: "Keep it warm." });
      expect((await store.getChat(chat.id))!.director).toEqual(set!.director);
      expect((await store.readMessages(main, { limit: 1 })).branchVersion).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("the archive of removed notes and hidden arcs keeps each row once by id, is not touched by a settings patch, and refuses a malformed row whole", async () => {
      const { store, chat } = await seeded(1);
      const note = { id: "note-1", content: "Keep her kind.", createdAt: 1, removedAt: 2 };
      const first = await store.archiveDirector(chat.id, { notes: [note] });
      expect(first!.director!.archive).toEqual({ notes: [note], hidden: [] });
      await store.archiveDirector(chat.id, { notes: [note, { ...note, id: "note-2" }] });
      expect((await store.getChat(chat.id))!.director!.archive!.notes.map((n) => n.id)).toEqual(["note-1", "note-2"]);
      await store.setDirectorSettings(chat.id, { creativity: "dramatic" });
      expect((await store.getChat(chat.id))!.director).toMatchObject({ creativity: "dramatic", archive: { notes: [{ id: "note-1" }, { id: "note-2" }] } });
      await expect(store.archiveDirector(chat.id, { notes: [{ content: "no id" } as never] })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setDirectorSettings(chat.id, { archive: { notes: [], hidden: [] } } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.archiveDirector("nope", { notes: [note] })).toBeNull();
    });

    test("auto-update (on or off), every (1 to 99 replies) and calls per reply (1 to 5) are settings; anything else is refused whole", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setDirectorSettings(chat.id, { autoUpdate: false, every: 99, callsPerReply: 5 }))!.director).toMatchObject({ autoUpdate: false, every: 99, callsPerReply: 5 });
      expect((await store.setDirectorSettings(chat.id, { autoUpdate: null, every: null }))!.director).toEqual({ callsPerReply: 5 });
      for (const bad of [{ every: 0 }, { every: 100 }, { every: 1.5 }, { every: "1" }, { callsPerReply: 0 }, { callsPerReply: 6 }, { callsPerReply: 2.5 }, { autoUpdate: "yes" }, { awareness: 1 }, { maxRounds: 2 }]) {
        await expect(store.setDirectorSettings(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.director).toEqual({ callsPerReply: 5 });
    });

    test("a snapshot holds no tracker receipts: what the Director changed in a tracker is scene state (rule 17), so a snapshot that names them is refused", async () => {
      const { store, chat, main } = await seeded(1);
      const ids = await more(store, main);
      const receipt = { module: "resources" as const, before: null, after: { hp: 40 }, turn: 1, at: 5 };
      await expect(store.putDirector(chat.id, ids[1]!, { ...blankDirector(), trackerUpdates: [receipt] } as never, { expectedVersion: null })).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.getDirector(chat.id, ids[1]!)).toBeNull();
    });

    test("a key left out stays, null goes back to the default, and a patch that leaves nothing leaves no cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setDirectorSettings(chat.id, { commandMode: "tagged", creativity: "dramatic" });
      expect((await store.setDirectorSettings(chat.id, { reasoning: "high" }))!.director).toEqual({ commandMode: "tagged", creativity: "dramatic", reasoning: "high" });
      expect((await store.setDirectorSettings(chat.id, { creativity: null }))!.director).toEqual({ commandMode: "tagged", reasoning: "high" });
      await store.setDirectorSettings(chat.id, { commandMode: null, reasoning: null });
      expect("director" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a bad patch is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setDirectorSettings(chat.id, { temperature: 1 });
      const bad: unknown[] = [{ personality: "the-nobody" }, { commandMode: "json" }, { creativity: "loud" }, { reasoning: "extreme" }, { temperature: 2.1 }, { temperature: -1 }, { autoRetry: "yes" }, { model: { id: "" } }, { instructions: "x".repeat(2_001) }, { enabled: true }, [], "x", null];
      for (const patch of bad) await expect(store.setDirectorSettings(chat.id, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.director).toEqual({ temperature: 1 });
    });

    test("it belongs to the chat: a missing or deleted chat answers null, and a restore brings it back", async () => {
      const { store, chat } = await seeded(1);
      await store.setDirectorSettings(chat.id, { personality: "the-jester" });
      await store.deleteChat(chat.id);
      expect(await store.setDirectorSettings(chat.id, { personality: "the-shadow" })).toBeNull();
      expect(await store.setDirectorSettings("nope", {})).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.director).toEqual({ personality: "the-jester" });
    });
  });

  describe("a reply's Director snapshot (rule 47)", () => {
    test("a take has none until one is written; a write is read back at and after its message, never before it", async () => {
      const { store, chat, main, ids } = await seeded(4);
      expect(await store.getDirector(chat.id, ids[3]!)).toBeNull();
      const wrote = await store.putDirector(chat.id, ids[3]!, blankDirector("one"), { expectedVersion: null });
      expect(wrote).toMatchObject({ messageId: ids[3] });
      expect(await store.getDirector(chat.id, ids[3]!)).toEqual(wrote);
      expect(await store.getDirector(chat.id, ids[2]!)).toBeNull();
      await store.appendMessage(main, { role: "user", content: "next" });
      const later = (await store.readMessages(main, { limit: 10 })).messages.at(-1)!;
      expect(noteOf(await store.getDirector(chat.id, later.id))).toBe("one");
      expect((await store.getDirector(chat.id, later.id))!.messageId).toBe(ids[3]!);
    });

    test("the guard refuses a write whose base is not the snapshot in effect, and every write is stamped later than the one before it", async () => {
      const { store, chat, ids } = await seeded(4);
      const one = (await store.putDirector(chat.id, ids[3]!, blankDirector("one"), { expectedVersion: null }))!;
      const two = (await store.putDirector(chat.id, ids[3]!, blankDirector("two"), { expectedVersion: one.version }))!;
      expect(two.version).toBeGreaterThan(one.version);
      const lost = await store.putDirector(chat.id, ids[3]!, blankDirector("three"), { expectedVersion: one.version }).then(() => null, (e: unknown) => e);
      expect(lost).toBeInstanceOf(StudioConflictError);
      const wrongNone = await store.putDirector(chat.id, ids[3]!, blankDirector("three"), { expectedVersion: null }).then(() => null, (e: unknown) => e);
      expect(wrongNone).toBeInstanceOf(StudioConflictError);
      expect(noteOf(await store.getDirector(chat.id, ids[3]!))).toBe("two");
    });

    test("only the take's last live message takes a write: an edit read at an old tip is refused once the scene has moved on", async () => {
      const { store, chat, main, ids } = await seeded(4);
      await store.appendMessage(main, { role: "user", content: "and then" });
      const stale = await store.putDirector(chat.id, ids[3]!, blankDirector("x"), { expectedVersion: null }).then(() => null, (e: unknown) => e);
      expect(stale).toBeInstanceOf(StudioConflictError);
      expect(await store.getDirector(chat.id, ids[3]!)).toBeNull();
    });

    test("each version of a reply has its own snapshot: swiping brings back the state that version was written from", async () => {
      const { store, chat, ids } = await seeded(2);
      const reply = ids[1]!;
      await store.putDirector(chat.id, reply, blankDirector("A"), { expectedVersion: null });
      await store.addSwipe(reply, { content: "line 2b" });
      await store.selectSwipe(reply, 1);
      expect(await store.getDirector(chat.id, reply)).toBeNull();
      const b = (await store.putDirector(chat.id, reply, blankDirector("B"), { expectedVersion: null }))!;
      expect(noteOf(b)).toBe("B");
      await store.selectSwipe(reply, 0);
      expect(noteOf(await store.getDirector(chat.id, reply))).toBe("A");
      await store.selectSwipe(reply, 1);
      expect(noteOf(await store.getDirector(chat.id, reply))).toBe("B");
    });

    test("a cut message and a cut version are skipped on read, and a restore brings the message back", async () => {
      const { store, chat, main, ids: first } = await seeded(2);
      await store.putDirector(chat.id, first[1]!, blankDirector("early"), { expectedVersion: null });
      const ids = [...first, ...(await more(store, main))];
      await store.putDirector(chat.id, ids[3]!, blankDirector("late"), { expectedVersion: (await store.getDirector(chat.id, ids[3]!))!.version });
      const cut = (await store.cutMessages(main, ids[3]!, "one"))!;
      expect(await store.getDirector(chat.id, ids[3]!)).toBeNull();
      expect(noteOf(await store.getDirector(chat.id, ids[2]!))).toBe("early");
      await store.restoreCut(main, cut.cutId);
      expect(noteOf(await store.getDirector(chat.id, ids[3]!))).toBe("late");
      await store.addSwipe(ids[3]!, { content: "line 4b" });
      await store.selectSwipe(ids[3]!, 1);
      expect(noteOf(await store.getDirector(chat.id, ids[3]!))).toBe("early");
      await store.cutSwipe(ids[3]!, (await store.readMessages(main, { limit: 10 })).messages[3]!.swipes[1]!.id);
      expect(noteOf(await store.getDirector(chat.id, ids[3]!))).toBe("late");
    });

    test("a fork carries the snapshots of the messages it copies, and then keeps its own", async () => {
      const { store, chat, main, ids: first } = await seeded(2);
      await store.putDirector(chat.id, first[1]!, blankDirector("early"), { expectedVersion: null });
      const ids = [...first, ...(await more(store, main))];
      const fork = (await store.fork(main, ids[2]!, { name: "Take 2" }))!;
      const copied = (await store.readMessages(fork.id, { limit: 10 })).messages;
      expect(copied).toHaveLength(3);
      expect(noteOf(await store.getDirector(chat.id, copied[2]!.id))).toBe("early");
      expect((await store.getDirector(chat.id, copied[2]!.id))!.messageId).toBe(copied[1]!.id);
      await store.putDirector(chat.id, copied[2]!.id, blankDirector("fork"), { expectedVersion: (await store.getDirector(chat.id, copied[2]!.id))!.version });
      expect(noteOf(await store.getDirector(chat.id, ids[3]!))).toBe("early");
      expect(noteOf(await store.getDirector(chat.id, copied[2]!.id))).toBe("fork");
    });

    test("a snapshot survives its take going to the Trash and coming back; a deleted scene answers nothing", async () => {
      const { store, chat, main, ids } = await seeded(2);
      const fork = (await store.fork(main, ids[1]!, { name: "Take 2" }))!;
      const tip = (await store.readMessages(fork.id, { limit: 10 })).messages.at(-1)!;
      await store.putDirector(chat.id, tip.id, blankDirector("kept"), { expectedVersion: null });
      await store.deleteBranch(fork.id);
      await store.restoreBranch(fork.id);
      expect(noteOf(await store.getDirector(chat.id, tip.id))).toBe("kept");
      await store.deleteChat(chat.id);
      expect(await store.getDirector(chat.id, tip.id)).toBeNull();
      expect(await store.putDirector(chat.id, tip.id, blankDirector("x"), { expectedVersion: null })).toBeNull();
    });

    test("the turn and the remembered edits ride in the state and come back whole", async () => {
      const { store, chat, ids } = await seeded(2);
      const state: DirectorState = { ...blankDirector(), turn: 7, edits: [{ id: "edit-1", at: 5, edit: { op: "add-note", content: "n" } }, { id: "edit-2", at: 6, edit: { op: "remove-arc", id: "arc-1" }, label: "The Lamp" }] };
      await store.putDirector(chat.id, ids[1]!, state, { expectedVersion: null });
      expect((await store.getDirector(chat.id, ids[1]!))!.state).toEqual(state);
    });

    test("a bad state is refused whole; a missing message or another scene's message answers null", async () => {
      const { store, chat, ids } = await seeded(2);
      const other = await seeded(2);
      await store.putDirector(chat.id, ids[1]!, blankDirector("keep"), { expectedVersion: null });
      const v = (await store.getDirector(chat.id, ids[1]!))!.version;
      const dup = { ...blankDirector(), arcs: [{ id: "a" }, { id: "a" }] };
      const bad: unknown[] = [{}, null, [], "x", { ...blankDirector(), extra: 1 }, { ...blankDirector(), arcs: "no" }, { ...blankDirector(), nextId: -1 }, { ...blankDirector(), activity: new Array(201).fill({}) }, dup, { ...blankDirector(), notes: [{ id: "", content: "x" }] }, { ...blankDirector(), suggestedActions: ["x".repeat(700_000)] }, { ...blankDirector(), turn: -1 }, { ...blankDirector(), turn: 1.5 }, { ...blankDirector(), edits: "no" }, { ...blankDirector(), edits: new Array(51).fill({ id: "e", at: 1, edit: { op: "reset" } }) }, { ...blankDirector(), edits: [{ id: 5, edit: {} }] }];
      for (const state of bad) await expect(store.putDirector(chat.id, ids[1]!, state as never, { expectedVersion: v })).rejects.toBeInstanceOf(StudioValidationError);
      expect(noteOf(await store.getDirector(chat.id, ids[1]!))).toBe("keep");
      expect(await store.putDirector(chat.id, "nope", blankDirector(), { expectedVersion: null })).toBeNull();
      expect(await store.getDirector(chat.id, "nope")).toBeNull();
      expect(await store.getDirector(chat.id, other.ids[1]!)).toBeNull();
      expect(await store.putDirector(chat.id, other.ids[1]!, blankDirector(), { expectedVersion: null })).toBeNull();
    });
  });
}
